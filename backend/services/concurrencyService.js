const redis = require('redis');

let redisClient = null;
const inMemoryLocks = new Map(); // Fallback when Redis unavailable

// Initialize Redis for distributed locks
const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => console.warn('⚠️ Redis error:', err.message));
    await redisClient.connect();
    console.log('✅ Redis locks connected');
  } catch (err) {
    console.warn('⚠️ Redis not available, using in-memory locks');
  }
};

const concurrencyService = {
  // Acquire lock to prevent race conditions
  async acquireLock(key, ttl = 5) {
    try {
      if (redisClient) {
        const result = await redisClient.set(key, '1', { NX: true, EX: ttl });
        return result === 'OK';
      }
    } catch (err) {
      console.warn('Lock acquisition failed, using fallback');
    }

    // In-memory fallback
    const now = Date.now();
    const lock = inMemoryLocks.get(key);
    if (!lock || lock.expiresAt < now) {
      inMemoryLocks.set(key, { expiresAt: now + (ttl * 1000) });
      return true;
    }
    return false;
  },

  // Release lock
  async releaseLock(key) {
    try {
      if (redisClient) {
        await redisClient.del(key);
        return true;
      }
    } catch (err) {
      console.warn('Lock release failed');
    }
    
    inMemoryLocks.delete(key);
    return true;
  }
};

initRedis();
module.exports = concurrencyService;
