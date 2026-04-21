/**
 * Shared inter-service HTTP client.
 *
 * All service-to-service calls go DIRECTLY between services (not through the gateway)
 * to avoid circular routing and unnecessary overhead.
 *
 * Usage:
 *   import { notify, wsBroadcast, sendEmail } from '../shared/interservice.js';
 */

import axios from 'axios';
import http from 'http';
import https from 'https';
import { traceStorage } from './logger.js';

// ── Shared Keep-Alive Agent ───────────────────────────────────────────────
// Keep TCP connections "hot" between services.
// maxSockets: 100 (Concurrency)
// maxFreeSockets: 10 (Idle pool)
const keepAliveAgentOptions = {
  keepAlive: true,
  maxSockets: 500,     // ⚡ Increased for massive inter-service parallelism
  maxFreeSockets: 50,  // ⚡ Keep 50 internal sockets 'hot' for instant reuse
  timeout: 60000, 
};

const httpAgent  = new http.Agent(keepAliveAgentOptions);
const httpsAgent = new https.Agent(keepAliveAgentOptions);

// ── Trace ID Interceptor ──────────────────────────────────────────────────
// Automatically inject the Trace ID from the current request context
axios.interceptors.request.use((config) => {
  const store = traceStorage.getStore();
  if (store && store.traceId) {
    config.headers['X-Request-ID'] = store.traceId;
  }
  return config;
});

// ── Service URLs ──────────────────────────────────────────────────────────
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  user: process.env.USER_SERVICE_URL || 'http://localhost:4002',
  admin: process.env.ADMIN_SERVICE_URL || 'http://localhost:4003',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4004',
  cache: process.env.CACHE_SERVICE_URL || 'http://localhost:4005',
  email: process.env.EMAIL_SERVICE_URL || 'http://localhost:4007',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4009',
  websocket: process.env.WEBSOCKET_SERVICE_URL || 'http://localhost:4010',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4011',
  subscription: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:4012',
  organizer: process.env.ORGANIZER_SERVICE_URL || 'http://localhost:4013',
  qr: process.env.QR_SERVICE_URL || 'http://localhost:4014',
  scanner: process.env.SCANNER_SERVICE_URL || 'http://localhost:4015',
  wallet: process.env.WALLET_SERVICE_URL || 'http://localhost:4016',
  ml: process.env.ML_SERVICE_URL || 'http://localhost:5000',
};

// ── Generic fire-and-forget helper ────────────────────────────────────────
// Logs errors but NEVER throws — inter-service calls must not crash the caller.
const fireAndForget = async (fn, label) => {
  try {
    await fn();
  } catch (err) {
    console.error(`[Inter-service] ${label} failed:`, err.message);
  }
};

// ── Notification Service ──────────────────────────────────────────────────
/**
 * Create a persistent notification for a user.
 * @param {string} userId
 * @param {'ticket_purchase'|'event_update'|'price_change'|'subscription'|'refund'|'system'} type
 * @param {string} title
 * @param {string} message
 * @param {object} [meta]
 */
export const notify = (userId, type, title, message, meta = {}) =>
  fireAndForget(
    () => axios.post(`${SERVICES.notification}/api/notifications`, { userId, type, title, message, meta }, { timeout: 5000, httpAgent, httpsAgent }),
    `notify(${type} → ${userId})`
  );

/**
 * Revert a ticket purchase (used when a refund is processed).
 * Return seats to inventory and subtract revenue.
 */
export const revertPurchase = (eventId, categoryName, quantity, amount) =>
  fireAndForget(
    () => axios.post(`${SERVICES.organizer}/api/tickets/revert`, { eventId, categoryName, quantity, amount }, { timeout: 5000, httpAgent, httpsAgent }),
    `revertPurchase(${eventId})`
  );

// ── WebSocket Service ─────────────────────────────────────────────────────
/**
 * Push a real-time notification to a specific connected user.
 */
export const wsNotifyUser = (userId, type, title, message, meta = {}) =>
  fireAndForget(
    () => axios.post(`${SERVICES.websocket}/api/ws/notify-user`, { userId, type, title, message, meta }, { timeout: 5000, httpAgent, httpsAgent }),
    `wsNotifyUser(${userId})`
  );

/**
 * Broadcast a ticket-sold event to ALL connected clients (updates seat counts live).
 */
export const wsTicketSold = (eventId, categoryName, remainingSeats) =>
  fireAndForget(
    () => axios.post(`${SERVICES.websocket}/api/ws/ticket-sold`, { eventId, categoryName, remainingSeats }, { timeout: 5000, httpAgent, httpsAgent }),
    `wsTicketSold(${eventId})`
  );

/**
 * Broadcast dynamic price update to ALL connected clients.
 */
export const wsPriceUpdate = (eventId, prices, occupancyRate) =>
  fireAndForget(
    () => axios.post(`${SERVICES.websocket}/api/ws/price-update`, { eventId, prices, occupancyRate }, { timeout: 5000, httpAgent, httpsAgent }),
    `wsPriceUpdate(${eventId})`
  );

/**
 * Broadcast attendance update to ALL connected clients.
 */
export const wsAttendanceUpdate = (eventId, scannedCount, totalSold) =>
  fireAndForget(
    () => axios.post(`${SERVICES.websocket}/api/ws/attendance-update`, { eventId, scannedCount, totalSold }, { timeout: 5000, httpAgent, httpsAgent }),
    `wsAttendanceUpdate(${eventId})`
  );

// ── Email Service ─────────────────────────────────────────────────────────
/**
 * Send a named email template.
 */
export const sendEmailTemplate = (to, templateName, data) =>
  fireAndForget(
    () => axios.post(`${SERVICES.email}/api/email/send-template`, { to, templateName, data }, { timeout: 5000, httpAgent, httpsAgent }),
    `sendEmailTemplate(${templateName} → ${to})`
  );

/**
 * Send a raw email.
 */
export const sendEmail = (to, subject, html) =>
  fireAndForget(
    () => axios.post(`${SERVICES.email}/api/email/send`, { to, subject, html }, { timeout: 5000, httpAgent, httpsAgent }),
    `sendEmail(→ ${to})`
  );

// ── Wallet Service ────────────────────────────────────────────────────────
/**
 * Credit a user's wallet (internal call).
 */
export const creditUserWallet = (userId, amount, description) =>
  fireAndForget(
    () => axios.post(`${SERVICES.wallet}/api/wallet/credit`, { userId, amount, description }, { timeout: 5000, httpAgent, httpsAgent }),
    `creditUserWallet(${userId})`
  );

/**
 * Debit a user's wallet (internal call).
 */
export const debitUserWallet = (userId, amount, description) =>
  fireAndForget(
    () => axios.post(`${SERVICES.wallet}/api/wallet/debit`, { userId, amount, description, internal: true }, { timeout: 5000, httpAgent, httpsAgent }),
    `debitUserWallet(${userId})`
  );

// ── Cache Service ─────────────────────────────────────────────────────────
/**
 * Cache a JSON value.
 */
export const cacheSet = (key, value, ttlSeconds) =>
  fireAndForget(
    () => axios.post(`${SERVICES.cache}/api/cache`, { key, value, ttl: ttlSeconds }, { timeout: 5000, httpAgent, httpsAgent }),
    `cacheSet(${key})`
  );

/**
 * Get a cached value. Returns null on miss, timeout (1s), or error.
 */
export const cacheGet = async (key) => {
  try {
    const { data } = await axios.get(`${SERVICES.cache}/api/cache/${key}`, { 
      timeout: 1000, // Reduced from 2s to fail faster
      httpAgent, 
      httpsAgent 
    });
    return data.value;
  } catch (err) {
    // If it's a 404, it's a simple cache miss — no need for error noise
    if (err.response?.status !== 404) {
      console.warn(`[Inter-service] cacheGet(${key}) failed or timed out: ${err.message}`);
    }
    return null; // caller continues without cache
  }
};

/**
 * Delete a cached value.
 */
export const cacheDel = (key) =>
  fireAndForget(
    async () => {
      try {
        await axios.delete(`${SERVICES.cache}/api/cache/${key}`, { timeout: 2000, httpAgent, httpsAgent });
      } catch (err) {
        // If it's a 404, it means the key is already gone, which is our goal.
        if (err.response?.status !== 404) throw err;
      }
    },
    `cacheDel(key)`
  );

/**
 * Atomicly acquire a distributed lock.
 * Returns { success, token } or null on failure.
 */
export const cacheLock = async (key, ttl = 5000, retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      const { data } = await axios.post(`${SERVICES.cache}/api/cache/lock`, { key, ttl }, { timeout: 2000, httpAgent, httpsAgent });
      if (data.success) return { success: true, token: data.token };

      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, i) * 100;
      await new Promise(r => setTimeout(r, delay));
    } catch (err) {
      console.error(`[Inter-service] cacheLock attempt ${i + 1} failed:`, err.message);
    }
  }
  return { success: false };
};

/**
 * Release a distributed lock.
 */
export const cacheUnlock = (key, token) =>
  fireAndForget(
    () => axios.post(`${SERVICES.cache}/api/cache/unlock`, { key, token }, { timeout: 2000, httpAgent, httpsAgent }),
    `cacheUnlock(${key})`
  );

/**
 * Delete all keys matching a pattern (e.g., 'events:list:*').
 */
export const cacheDelPattern = (pattern) =>
  fireAndForget(
    () => axios.delete(`${SERVICES.cache}/api/cache/pattern/${encodeURIComponent(pattern)}`, { timeout: 5000, httpAgent, httpsAgent }),
    `cacheDelPattern(${pattern})`
  );

// ── Cache Key Registry ───────────────────────────────────────────────────
// Centralized key generators to ensure consistency across services.
export const CACHE_KEYS = {
  // Event-related
  EVENT_DETAIL: (id) => `event:${id}`,
  EVENT_PRICES: (id) => `prices:${id}`,
  EVENT_LIST: (query = '{}') => `events:list:${query}`,
  EVENT_LIST_ALL: 'events:list:*',

  // Analytics
  ANALYTICS_SUMMARY: 'analytics:summary',
};
