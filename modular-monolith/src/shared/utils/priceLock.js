import { cacheGet, cacheSet, cacheDel } from './cache.js';
import { logInfo } from './logger.js';

/**
 * 🔒 Price Lock Reservation System
 * 
 * Guarantees a calculated price for a user for a specific duration (5 mins).
 * Prevents "Price Shock" during the checkout process.
 */

const LOCK_DURATION = 300; // 5 minutes

/**
 * Create a price lock for a user/event/category combination
 */
export const createPriceLock = async (userId, eventId, categoryId, price) => {
  const lockKey = `pricelock:${userId}:${eventId}:${categoryId || 'base'}`;
  
  // OS Concept: Atomic Guard
  // Only create a new lock if one doesn't exist or has expired.
  // This prevents multiple "price prediction" requests from bouncing the price.
  const lockData = {
    price,
    expiresAt: Date.now() + (LOCK_DURATION * 1000)
  };

  const success = await cacheSetNX(lockKey, lockData, LOCK_DURATION);
  if (success) {
    return lockData;
  }

  // If set failed, return the existing lock
  return await cacheGet(lockKey);
};


/**
 * Retrieve and verify a price lock
 */
export const getVerifiedPrice = async (userId, eventId, categoryId, currentServerPrice) => {
  const lockKey = `pricelock:${userId}:${eventId}:${categoryId || 'base'}`;
  const lockedData = await cacheGet(lockKey);

  if (lockedData && lockedData.expiresAt > Date.now()) {
    logInfo('PriceLock', `Using locked price: ₹${lockedData.price} (Server: ₹${currentServerPrice})`, { lockedPrice: lockedData.price, serverPrice: currentServerPrice });
    return lockedData.price;
  }

  return currentServerPrice;
};

/**
 * Clear a lock after successful purchase
 */
export const releasePriceLock = async (userId, eventId, categoryId) => {
  const lockKey = `pricelock:${userId}:${eventId}:${categoryId || 'base'}`;
  await cacheDel(lockKey);
};

export default { createPriceLock, getVerifiedPrice, releasePriceLock };
