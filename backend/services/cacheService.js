// Dynamic Ticket Pricing System v2.0
const redis = require('redis');

let redisClient = null;
let isConnected = false;

// Initialize Redis client
const initRedis = async () => {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log('⚠️ Redis: Connection failed, running without cache');
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 1000);
        }
      }
    });

    redisClient.on('error', () => {
      // Silently handle errors to prevent crashes
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      isConnected = true;
    });

    try {
      await redisClient.connect();
    } catch (err) {
      console.warn('⚠️  Redis not available, caching disabled');
      isConnected = false;
    }
  }
  return redisClient;
};

// Cache service with fallback
const cacheService = {
  async get(key) {
    if (!isConnected) return null;
    
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Cache get error:', err);
      return null;
    }
  },

  async set(key, value, ttl = 300) {
    if (!isConnected) return false;
    
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Cache set error:', err);
      return false;
    }
  },

  async del(key) {
    if (!isConnected) return false;
    
    try {
      await redisClient.del(key);
      return true;
    } catch (err) {
      console.error('Cache delete error:', err);
      return false;
    }
  },

  async clear() {
    if (!isConnected) return false;
    
    try {
      await redisClient.flushAll();
      return true;
    } catch (err) {
      console.error('Cache clear error:', err);
      return false;
    }
  },

  async invalidatePattern(pattern) {
    // For in-memory fallback or when Redis is not connected, just return
    if (!isConnected) return false;
    
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (err) {
      console.error('Cache invalidate pattern error:', err);
      return false;
    }
  }
};

// Initialize on module load
initRedis().catch(err => {
  console.warn('⚠️  Cache service initialization failed, running without cache');
});

module.exports = cacheService;
