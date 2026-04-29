import Redis from 'ioredis';
import config from '../config/index.js';
import { logInfo, logWarn, logError } from './logger.js';

/**
 * 🧊 Central Cache Utility (Redis)
 * 
 * Provides high-speed in-memory data storage for:
 * - Session Blacklisting
 * - Hot-path API data
 * - Rate limit state
 */

let redis;

try {
  // Configure Redis to fail fast on offline queues and limit retries to avoid
  // long-running command timeouts when Redis is unavailable in local dev.
  redis = new Redis(config.redis.uri || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 10000,
    lazyConnect: true,
    enableOfflineQueue: false,
    // Reconnect strategy: gentle exponential backoff up to 10s
    retryStrategy: (times) => Math.min(times * 200, 10000),
    reconnectOnError: (err) => {
      // Only reconnect on network errors
      const msg = err && err.message ? err.message : '';
      return /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH/.test(msg);
    }
  });

  redis.on('connect', () => logInfo('Cache', 'Redis connected'));
  redis.on('ready', () => logInfo('Cache', 'Redis ready'));
  redis.on('reconnecting', (delay) => logInfo('Cache', `Redis reconnecting in ${delay}ms`));
  redis.on('error', (err) => {
    logWarn('Cache', 'Redis error', { message: err && err.message ? err.message : err });
  });
} catch (err) {}

let pub, sub;
if (config.redis.uri) {
  // Create pub/sub clients lazily so the app can run without a live Redis during dev.
  const pubsubOpts = {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    // Pub/Sub often expects queued commands during subscription setup — keep
    // the offline queue enabled so subscribers can register even if Redis
    // becomes available slightly later.
    enableOfflineQueue: true,
    retryStrategy: (times) => Math.min(times * 200, 10000)
  };
  pub = new Redis(config.redis.uri, pubsubOpts);
  sub = new Redis(config.redis.uri, pubsubOpts);
  pub.on('error', (e) => logWarn('Cache', 'Redis PUB error', { message: e && e.message ? e.message : e }));
  sub.on('error', (e) => logWarn('Cache', 'Redis SUB error', { message: e && e.message ? e.message : e }));
}

// If Redis is not configured or failed, provide an in-memory Pub/Sub fallback
// so features like broadcaster still work in single-node local development.
if (!pub || !sub) {
  const { EventEmitter } = await import('events');
  const emitter = new EventEmitter();

  pub = {
    publish: async (channel, message) => {
      // Emit both a channel-specific event and a generic 'message' event.
      process.nextTick(() => {
        emitter.emit('message', channel, message);
        emitter.emit(channel, message);
      });
      return 1;
    }
  };

  sub = {
    subscribe: (channel, cb) => {
      // mimic redis callback signature (err, count)
      emitter.on(channel, () => {});
      if (typeof cb === 'function') process.nextTick(() => cb(null, 1));
    },
    on: (event, handler) => {
      // allow 'message' event handlers used by broadcaster
      emitter.on(event, handler);
    }
  };

  logInfo('Cache', 'Using in-memory Pub/Sub fallback (no Redis)');
}

export const getPubSub = () => ({ pub, sub });

export const getRedisClient = () => redis;

// ── Tier 1: Local Memory Cache (Phase 16) ──
const localCache = new Map();
const LOCAL_TTL = 1500; // 1.5 seconds
const CACHE_META_FLAG = '__cache_meta__';

const isReady = () => redis && redis.status === 'ready';

const ensureConnected = async () => {
  if (!redis) return false;
  if (redis.status === 'ready') return true;
  try {
    await redis.connect();
    return redis.status === 'ready';
  } catch (err) {
    return false;
  }
};

const wrapCacheValue = (value, ttlSeconds) => ({
  val: value,
  at: Date.now(),
  ttl: ttlSeconds,
  [CACHE_META_FLAG]: true
});

const unwrapCacheValue = (payload, options = {}) => {
  if (payload && typeof payload === 'object' && payload[CACHE_META_FLAG]) {
    return options.includeMetadata ? payload : payload.val;
  }
  return payload;
};

export const cacheGet = async (key, options = {}) => {
  // Check local cache first (sub-millisecond)
  const local = localCache.get(key);
  if (local && Date.now() - local.at < LOCAL_TTL) {
    return unwrapCacheValue(local.data, options);
  }

  if (!isReady()) {
    // Try a single connect attempt for lazy clients
    const ok = await ensureConnected();
    if (!ok) return null;
  }
  try {
    const data = await redis.get(key);
    const parsed = data ? JSON.parse(data) : null;

    // Populate local cache for hot-path
    if (parsed) localCache.set(key, { data: parsed, at: Date.now() });

    return unwrapCacheValue(parsed, options);
  } catch (err) {
    return null;
  }
};

export const cacheSet = async (key, value, ttlSeconds = 3600) => {
  const wrapped = wrapCacheValue(value, ttlSeconds);

  // Update local cache
  localCache.set(key, { data: wrapped, at: Date.now() });

  if (!isReady()) {
    const ok = await ensureConnected();
    if (!ok) return null;
  }
  try {
    return await redis.set(key, JSON.stringify(wrapped), 'EX', ttlSeconds);
  } catch (err) {
    return null;
  }
};

/**
 * cacheSetNX
 * Atomic "Set if Not Exists" operation for Idempotency.
 */
export const cacheSetNX = async (key, value, ttlSeconds = 60) => {
  const wrapped = wrapCacheValue(value, ttlSeconds);

  if (!isReady()) {
    const ok = await ensureConnected();
    if (!ok) return false;
  }
  try {
    const result = await redis.set(key, JSON.stringify(wrapped), 'EX', ttlSeconds, 'NX');
    const success = result === 'OK';
    if (success) {
      localCache.set(key, { data: wrapped, at: Date.now() });
    }
    return success;
  } catch (err) {
    return false;
  }
};

// ── Cache Versioning (Phase 16) ──
// Allows for instant invalidation of all lists by incrementing a single key.
export const getCacheVersion = async () => {
  const v = await cacheGet('system:cache:version');
  return v || 1;
};

export const bumpCacheVersion = async () => {
  if (!isReady()) {
    const ok = await ensureConnected();
    if (!ok) return;
  }
  const newV = Date.now();
  await cacheSet('system:cache:version', newV, 86400 * 7); // 7 days
  localCache.clear(); // Clear local cache on version bump
  return newV;
};

export const cacheDel = async (key) => {
  localCache.delete(key);
  if (!isReady()) return 0;
  try { return await redis.del(key); } catch (err) { return 0; }
};

const scanKeys = async (pattern) => {
  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, found] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (found && found.length) keys.push(...found);
  } while (cursor !== '0');
  return keys;
};

export const cacheDelPattern = async (pattern) => {
  if (!isReady()) return 0;
  try {
    const keys = await scanKeys(pattern);
    if (keys.length > 0) return await redis.del(...keys);
    return 0;
  } catch (err) {
    return 0;
  }
};

export const invalidateEventCache = async (eventId) => {
  if (eventId) await cacheDel(`event:${eventId}`);
  return await cacheDelPattern('events:list:*');
};

// ── JWT Blacklisting ──

export const blacklistToken = async (token, expirySeconds) => {
  if (!isReady()) {
    const ok = await ensureConnected();
    if (!ok) return null;
  }
  try { return await redis.set(`blacklist:${token}`, 'true', 'EX', expirySeconds); } catch (err) { return null; }
};

export const isTokenBlacklisted = async (token) => {
  if (!isReady()) {
    const ok = await ensureConnected();
    if (!ok) return false;
  }
  try { const exists = await redis.exists(`blacklist:${token}`); return exists === 1; } catch (err) { return false; }
};

export default {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  invalidateEventCache,
  blacklistToken,
  isTokenBlacklisted,
  cacheSetNX
};

