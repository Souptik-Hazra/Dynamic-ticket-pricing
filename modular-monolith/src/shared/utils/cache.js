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

const isReady = () => redis && redis.status === 'ready';

export const cacheGet = async (key) => {
  if (!isReady()) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) { return null; }
};

export const cacheSet = async (key, value, ttlSeconds = 3600) => {
  if (!isReady()) return null;
  try {
    return await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) { return null; }
};

export const cacheDel = async (key) => {
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
