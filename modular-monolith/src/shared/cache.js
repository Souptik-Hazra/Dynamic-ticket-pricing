import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisReady = false;

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 200, 3000);
  },
});

redis.on('connect', () => { redisReady = true; console.log('✅ [Cache] Redis connected'); });
redis.on('ready', () => { redisReady = true; });
redis.on('close', () => { redisReady = false; console.warn('⚠️ [Cache] Redis connection closed'); });
redis.on('error', (err) => {
  redisReady = false;
  if (err.code !== 'ECONNREFUSED') console.error('❌ [Cache] Redis error:', err.message);
});

// Attempt initial connection
redis.connect().catch(() => {});

// ── In-Memory Fallback ───────────────────────────────────────────
const localStore = new Map();
const localLocks = new Map();

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of localStore) {
    if (data.expires && now > data.expires) localStore.delete(key);
  }
  for (const [key, data] of localLocks) {
    if (now > data.expires) localLocks.delete(key);
  }
}, 10000);

// ── Exported Methods ─────────────────────────────────────────────

export const cacheSet = async (key, value, ttlSeconds) => {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (redisReady) {
    if (ttlSeconds) await redis.set(key, serialized, 'EX', ttlSeconds);
    else await redis.set(key, serialized);
  } else {
    localStore.set(key, {
      value: serialized,
      expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }
};

export const cacheGet = async (key) => {
  let raw = null;
  if (redisReady) {
    raw = await redis.get(key);
  } else {
    const data = localStore.get(key);
    if (data) {
      if (data.expires && Date.now() > data.expires) localStore.delete(key);
      else raw = data.value;
    }
  }
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
};

export const cacheDel = async (key) => {
  if (redisReady) await redis.del(key);
  else localStore.delete(key);
};

export const cacheDelPattern = async (pattern) => {
  if (redisReady) {
    const stream = redis.scanStream({ match: pattern, count: 100 });
    for await (const resultKeys of stream) {
      if (resultKeys.length > 0) await redis.del(...resultKeys);
    }
  } else {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of localStore.keys()) {
      if (regex.test(key)) localStore.delete(key);
    }
  }
};

export const cacheLock = async (key, ttl = 5000) => {
  const token = Math.random().toString(36).substring(2, 15);
  if (redisReady) {
    const result = await redis.set(key, token, 'NX', 'PX', ttl);
    if (result === 'OK') return { success: true, token };
  } else {
    const now = Date.now();
    const existing = localLocks.get(key);
    if (!existing || now > existing.expires) {
      localLocks.set(key, { token, expires: now + ttl });
      return { success: true, token };
    }
  }
  return { success: false };
};

export const cacheUnlock = async (key, token) => {
  if (redisReady) {
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(luaScript, 1, key, token);
  } else {
    const existing = localLocks.get(key);
    if (existing && existing.token === token) localLocks.delete(key);
  }
};

export default { cacheSet, cacheGet, cacheDel, cacheDelPattern, cacheLock, cacheUnlock };
