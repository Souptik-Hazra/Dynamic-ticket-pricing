import crypto from 'crypto';

/**
 * 🛠️ Generic Helpers
 * 
 * Generic utilities that do not belong to any specific domain.
 * Domain-specific logic has been moved to respective modules.
 */

export const formatDate = (date) => new Date(date).toISOString();

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const createBookingReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `FF-${timestamp}-${random}`;
};

export default { formatDate, sleep, createBookingReference };

