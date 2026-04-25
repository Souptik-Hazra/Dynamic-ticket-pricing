import { cacheGet, cacheSet, cacheDel } from './cache.js';

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
  const lockData = {
    price,
    expiresAt: Date.now() + (LOCK_DURATION * 1000)
  };

  await cacheSet(lockKey, lockData, LOCK_DURATION);
  return lockData;
};

/**
 * Retrieve and verify a price lock
 */
export const getVerifiedPrice = async (userId, eventId, categoryId, currentServerPrice) => {
  const lockKey = `pricelock:${userId}:${eventId}:${categoryId || 'base'}`;
  const lockedData = await cacheGet(lockKey);

  if (lockedData && lockedData.expiresAt > Date.now()) {
    console.log(`🔒 [PriceLock] Using locked price: ₹${lockedData.price} (Server: ₹${currentServerPrice})`);
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
