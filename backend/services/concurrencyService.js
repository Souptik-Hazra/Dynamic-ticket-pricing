const redis = require('redis');

let redisClient = null;
let isConnected = false;
let distributedModeWarningShown = false;

// Initialize Redis client for distributed locking
const initRedis = async () => {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) return false; // Stop reconnecting
          return Math.min(retries * 100, 1000);
        }
      }
    });

    redisClient.on('error', () => {
      // Silently handle errors
      isConnected = false;
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('✅ Redis connected - distributed locking enabled');
    });

    try {
      await redisClient.connect();
    } catch (err) {
      console.warn('⚠️  Redis not available for locks, using in-memory fallback');
      console.warn('⚠️  WARNING: In-memory locks only work for single-server deployments.');
      console.warn('⚠️  For multi-server/distributed deployments, configure REDIS_URL to prevent race conditions.');
      isConnected = false;
    }
  }
  return redisClient;
};

// In-memory fallback for locking
const inMemoryLocks = new Map();

const concurrencyService = {
  async acquireLock(key, ttl = 10) {
    if (isConnected) {
      try {
        const result = await redisClient.set(key, '1', {
          NX: true,
          EX: ttl
        });
        return result === 'OK';
      } catch (err) {
        console.error('Lock acquisition error:', err);
        return this.acquireLockInMemory(key, ttl);
      }
    } else {
      return this.acquireLockInMemory(key, ttl);
    }
  },

  async releaseLock(key) {
    if (isConnected) {
      try {
        await redisClient.del(key);
        return true;
      } catch (err) {
        console.error('Lock release error:', err);
        return this.releaseLockInMemory(key);
      }
    } else {
      return this.releaseLockInMemory(key);
    }
  },

  // In-memory fallback methods
  // WARNING: These only work for single-server deployments
  acquireLockInMemory(key, ttl) {
    if (!distributedModeWarningShown && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  PRODUCTION WARNING: Using in-memory locks! This will cause race conditions in multi-server deployments.');
      distributedModeWarningShown = true;
    }
    
    const now = Date.now();
    const lock = inMemoryLocks.get(key);
    
    if (!lock || lock.expiresAt < now) {
      inMemoryLocks.set(key, {
        expiresAt: now + (ttl * 1000)
      });
      return true;
    }
    
    return false;
  },

  releaseLockInMemory(key) {
    inMemoryLocks.delete(key);
    return true;
  },

  // Cleanup expired locks periodically
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, lock] of inMemoryLocks.entries()) {
        if (lock.expiresAt < now) {
          inMemoryLocks.delete(key);
        }
      }
    }, 5000); // Clean every 5 seconds
  },
  
  // Initialize Redis connection
  async init() {
    return initRedis();
  },
  
  // Check if Redis is connected
  isConnected() {
    return isConnected;
  }
};

// Start cleanup on module load
concurrencyService.startCleanup();

module.exports = concurrencyService;
module.exports = concurrencyService;
