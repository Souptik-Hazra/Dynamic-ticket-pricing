// Dynamic Ticket Pricing System v2.0
const redis = require('redis');

let redisClient = null;
let isConnected = false;

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
    });

    try {
      await redisClient.connect();
    } catch (err) {
      console.warn('⚠️  Redis not available for locks, using in-memory fallback');
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
  acquireLockInMemory(key, ttl) {
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
  }
};

// Initialize
initRedis().catch(err => {
  console.warn('⚠️  Concurrency service using in-memory locks');
});

concurrencyService.startCleanup();

module.exports = concurrencyService;
