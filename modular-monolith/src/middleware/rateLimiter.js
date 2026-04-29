import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../shared/utils/cache.js';
import { getStressFactor } from './adaptiveThrottler.js';
import { logWarn, logDebug } from '../shared/utils/logger.js';

const redis = getRedisClient();

/**
 * 🛠️ RedisStore Factory
 */
const createStore = (prefix) => {
  try {
    if (!redis || redis.status !== 'ready') return undefined;
    return new RedisStore({
      prefix: `rate-limit:${prefix}:`,
      sendCommand: (...args) => redis.call(...args),
    });
  } catch (err) {
    logWarn('RateLimiter', 'RedisStore unavailable, falling back to memory store', { error: err && err.message ? err.message : err });
    return undefined;
  }
};

/**
 * 🧠 Adaptive Limit Calculator
 * Halves the limit if:
 * 1. The system is under high load (stress factor < 1.0)
 * 2. The user is flagged as a suspected bot
 */
const getAdaptiveLimit = (baseLimit, req) => {
  let limit = baseLimit;
  
  // Apply system stress reduction
  const stressFactor = getStressFactor();
  limit = Math.floor(limit * stressFactor);

  // Apply bot suspicion reduction
  if (req.isSuspectedBot) {
    limit = Math.floor(limit * 0.5);
  }

  const finalLimit = Math.max(limit, 1);
  if (process.env.NODE_ENV === 'test') {
    logDebug('RateLimiter', `IP: ${req.ip} | Base: ${baseLimit} | Final: ${finalLimit} | Bot: ${!!req.isSuspectedBot}`);
  }

  return finalLimit;
};


export const authLimiter = rateLimit({
  store: createStore('auth'),
  windowMs: 15 * 60 * 1000,
  limit: (req) => getAdaptiveLimit(20, req), 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_AUTH_ATTEMPTS', message: 'Too many login attempts. Please try again in 15 minutes.' },
});

export const apiLimiter = rateLimit({
  store: createStore('api'),
  windowMs: 1 * 60 * 1000,
  limit: (req) => getAdaptiveLimit(500, req), 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'You are moving too fast.' },
});

/**
 * 🎫 Ticket Release Limiter (Flash Sales)
 * Very short window, low limit for high-stakes endpoints.
 */
export const ticketReleaseLimiter = rateLimit({
  store: createStore('tickets-release'),
  windowMs: 10 * 1000, // 10 seconds
  limit: (req) => getAdaptiveLimit(5, req), 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TICKET_BURST_LIMIT', message: 'Please slow down. Ticket demand is high.' },
});

/**
 * 🏷️ Pricing Scraper Limiter
 * Specifically for the catalog/details to prevent dynamic pricing harvesting.
 */
export const pricingScraperLimiter = rateLimit({
  store: createStore('pricing-guard'),
  windowMs: 1 * 60 * 1000,
  limit: (req) => getAdaptiveLimit(100, req), 
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'PRICING_SCRAPE_DETECTED', message: 'Access throttled for pricing analysis.' },
});

export const purchaseLimiter = rateLimit({
  store: createStore('purchase'),
  windowMs: 1 * 60 * 1000,
  limit: (req) => getAdaptiveLimit(10, req),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TRANSACTION_THROTTLED', message: 'Please wait before attempting another purchase.' },
});

export default {
  authLimiter,
  apiLimiter,
  ticketReleaseLimiter,
  pricingScraperLimiter,
  purchaseLimiter
};

