const redis = require('redis');

let redisClient = null;

// Initialize Redis for caching
const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => console.warn('Redis error:', err.message));
    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️ Redis not available, cache disabled');
  }
};

const cacheService = {
  async get(key) {
    if (!redisClient) return null;
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      return null;
    }
  },

  async set(key, value, ttl = 300) {
    if (!redisClient) return false;
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  },

  async delete(key) {
    if (!redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (err) {
      return false;
    }
  },

  async clear() {
    if (!redisClient) return false;
    try {
      await redisClient.flushAll();
      return true;
    } catch (err) {
      return false;
    }
  }
};

initRedis();
module.exports = cacheService;
