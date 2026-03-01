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
  },

  // Optimistic locking pattern for concurrent updates
  async optimisticUpdate(Model, id, callback) {
    try {
      // Read current document version
      const document = await Model.findById(id);
      
      if (!document) {
        throw new Error('Document not found');
      }

      // Store original version
      const originalVersion = document.__v || 0;

      // Execute callback with document
      const result = await callback(document);

      // Update with version check (optimistic lock)
      const updatedDoc = await Model.findByIdAndUpdate(
        id,
        result.updates || result,
        { 
          new: true,
          runValidators: true,
          // MongoDB version key for optimistic locking
          upsert: false
        }
      );

      if (!updatedDoc) {
        throw new Error('Concurrent modification detected. Please retry.');
      }

      return result;
    } catch (err) {
      throw new Error(`Optimistic update failed: ${err.message}`);
    }
  },

  // Rate limiting per key with time window
  async rateLimit(key, limit, windowSeconds) {
    try {
      if (redisClient) {
        const current = await redisClient.incr(key);
        
        if (current === 1) {
          // First request in window, set expiration
          await redisClient.expire(key, windowSeconds);
        }
        
        return current <= limit;
      }
    } catch (err) {
      console.warn('Rate limit check failed, using fallback');
    }

    // In-memory fallback
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    
    if (!inMemoryLocks.has(`rateLimit:${key}`)) {
      inMemoryLocks.set(`rateLimit:${key}`, {
        count: 1,
        expiresAt: now + windowMs
      });
      return true;
    }

    const counter = inMemoryLocks.get(`rateLimit:${key}`);
    
    if (counter.expiresAt < now) {
      // Window expired, reset
      inMemoryLocks.set(`rateLimit:${key}`, {
        count: 1,
        expiresAt: now + windowMs
      });
      return true;
    }

    // Window active, check limit
    if (counter.count < limit) {
      counter.count++;
      return true;
    }

    return false;
  },

  // Process array of items with concurrency limit
  async batchProcess(items, processor, maxConcurrency = 3) {
    const results = [];
    const queue = [...items];
    const executing = [];

    while (queue.length > 0 || executing.length > 0) {
      // Fill up to max concurrency
      while (executing.length < maxConcurrency && queue.length > 0) {
        const item = queue.shift();
        const promise = Promise.resolve()
          .then(() => processor(item))
          .then(result => {
            results.push(result);
            executing.splice(executing.indexOf(promise), 1);
          })
          .catch(error => {
            results.push({ error: error.message });
            executing.splice(executing.indexOf(promise), 1);
          });
        
        executing.push(promise);
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    return results;
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
