import Redis from 'ioredis';
import config from '../config/index.js';

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
  redis = new Redis(config.redis.uri || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    commandTimeout: 500, // Fail fast if Redis is slow
    lazyConnect: true
  });

  redis.on('connect', () => console.log('✅ [Cache] Redis connected'));
  redis.on('error', (err) => {
    // console.error('❌ [Cache] Redis error:', err.message);
  });
} catch (err) {}

let pub, sub;
if (config.redis.uri) {
  pub = new Redis(config.redis.uri, { maxRetriesPerRequest: null });
  sub = new Redis(config.redis.uri, { maxRetriesPerRequest: null });
  pub.on('error', () => {});
  sub.on('error', () => {});
}

export const getPubSub = () => ({ pub, sub });

export const getRedisClient = () => redis;

// ── Tier 1: Local Memory Cache (Phase 16) ──
const localCache = new Map();
const LOCAL_TTL = 1500; // 1.5 seconds

const isReady = () => redis && (redis.status === 'ready' || redis.status === 'connect');

export const cacheGet = async (key, options = {}) => {
  // Check Local Cache first (Sub-millisecond)
  const local = localCache.get(key);
  if (local && (Date.now() - local.at < LOCAL_TTL)) {
    const data = local.data;
    if (data && typeof data === 'object' && data._w) {
      return options.includeMetadata ? data : data.val;
    }
    return data;
  }

  if (!isReady()) return null;
  try {
    const data = await redis.get(key);
    const parsed = data ? JSON.parse(data) : null;
    
    // Populate Local Cache for hot-path
    if (parsed) localCache.set(key, { data: parsed, at: Date.now() });
    
    if (parsed && typeof parsed === 'object' && parsed._w) {
      return options.includeMetadata ? parsed : parsed.val;
    }
    return parsed;
  } catch (err) { return null; }
};

export const cacheSet = async (key, value, ttlSeconds = 3600) => {
  const wrapped = {
    val: value,
    at: Date.now(),
    ttl: ttlSeconds,
    _w: true
  };

  // Update Local Cache
  localCache.set(key, { data: wrapped, at: Date.now() });

  if (!isReady()) return null;
  try {
    return await redis.set(key, JSON.stringify(wrapped), 'EX', ttlSeconds);
  } catch (err) { return null; }
};

// ── Cache Versioning (Phase 16) ──
// Allows for instant invalidation of all lists by incrementing a single key.
export const getCacheVersion = async () => {
  const v = await cacheGet('system:cache:version');
  return v || 1;
};

export const bumpCacheVersion = async () => {
  if (!isReady()) return;
  const newV = Date.now();
  await cacheSet('system:cache:version', newV, 86400 * 7); // 7 days
  localCache.clear(); // Clear local cache on version bump
  return newV;
};

export const cacheDel = async (key) => {
  localCache.delete(key);
  if (!redis) return 0;
  return await redis.del(key);
};

export const cacheDelPattern = async (pattern) => {
  if (!redis) return 0;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) return await redis.del(...keys);
  return 0;
};

// ── JWT Blacklisting ──

export const blacklistToken = async (token, expirySeconds) => {
  if (!isReady()) return null;
  try {
    return await redis.set(`blacklist:${token}`, 'true', 'EX', expirySeconds);
  } catch (err) { return null; }
};

export const isTokenBlacklisted = async (token) => {
  if (!isReady()) return false;
  try {
    const exists = await redis.exists(`blacklist:${token}`);
    return exists === 1;
  } catch (err) { return false; }
};

export default {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
  blacklistToken,
  isTokenBlacklisted
};
