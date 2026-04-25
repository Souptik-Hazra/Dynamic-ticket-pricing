import rateLimit from 'express-rate-limit';

/**
 * 🚀 High-Performance Rate Limiter
 * 
 * Implements Tiered Throttling:
 * 1. Auth Tier: Strict limits for login/register to prevent brute force.
 * 2. API Tier: Standard limits for general data fetching.
 * 3. Payment Tier: Transaction-specific limits to prevent double-click abuse.
 */

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per IP
  message: { error: 'TOO_MANY_AUTH_ATTEMPTS', message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per IP (Phase 8 Stress Test)
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'You are moving too fast. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const purchaseLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'TRANSACTION_THROTTLED', message: 'Please wait before attempting another purchase.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  authLimiter,
  apiLimiter,
  purchaseLimiter
};
