const redis = require('redis');

let redisClient = null;

// Initialize Redis for distributed locks
const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => console.warn('Redis error:', err.message));
    await redisClient.connect();
  } catch (err) {
    console.error('❌ Redis required but not available:', err.message);
    throw err;
  }
};

const concurrencyService = {
  // Acquire lock to prevent race conditions
  async acquireLock(key, ttl = 5) {
    const result = await redisClient.set(key, '1', { NX: true, EX: ttl });
    return result === 'OK';
  },

  // Release lock
  async releaseLock(key) {
    await redisClient.del(key);
    return true;
  },
  // Rate limiting per key with time window
  async rateLimit(key, limit, windowSeconds) {
    const current = await redisClient.incr(key);
    
    if (current === 1) {
      // First request in window, set expiration
      await redisClient.expire(key, windowSeconds);
    }
    
    return current <= limit;
  },

  // Execute callback within a distributed lock
  async withLock(key, callback, ttl = 30) {
    const lockToken = await this.acquireLock(key, ttl);

    if (!lockToken) {
      throw new Error('Could not acquire lock. Resource is busy.');
    }

    try {
      const result = await callback();
      return result;
    } finally {
      await this.releaseLock(key);
    }
  }
};

initRedis();
module.exports = concurrencyService;
