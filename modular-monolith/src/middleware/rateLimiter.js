import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../shared/utils/cache.js';

const redis = getRedisClient();

/**
 * 🛠️ RedisStore Factory
 * OS/Network Concept: Distributed Rate Limiting
 * Each rate limiter must have its own store instance with a unique prefix
 * to avoid state collision in a cluster.
 */
const createStore = (prefix) => {
  if (!redis) return undefined;
  return new RedisStore({
    prefix: `rate-limit:${prefix}:`,
    sendCommand: (...args) => redis.call(...args),
  });
};

export const authLimiter = rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, 
  message: { error: 'TOO_MANY_AUTH_ATTEMPTS', message: 'Too many login attempts. Please try again in 15 minutes.' },
});

export const apiLimiter = rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('api'),
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, 
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'You are moving too fast. Please slow down.' },
});

export const purchaseLimiter = rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('purchase'),
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'TRANSACTION_THROTTLED', message: 'Please wait before attempting another purchase.' },
});



export default {
  authLimiter,
  apiLimiter,
  purchaseLimiter
};
