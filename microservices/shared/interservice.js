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

// ── Service URLs ──────────────────────────────────────────────────────────
const SERVICES = {
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4009',
  websocket:    process.env.WEBSOCKET_SERVICE_URL    || 'http://localhost:4010',
  email:        process.env.EMAIL_SERVICE_URL        || 'http://localhost:4007',
  payment:      process.env.PAYMENT_SERVICE_URL      || 'http://localhost:4004',
  cache:        process.env.CACHE_SERVICE_URL        || 'http://localhost:4005',
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
    () => axios.post(`${SERVICES.notification}/api/notifications`, { userId, type, title, message, meta }),
    `notify(${type} → ${userId})`
  );

// ── WebSocket Service ─────────────────────────────────────────────────────
/**
 * Push a real-time notification to a specific connected user.
 */
export const wsNotifyUser = (userId, type, title, message, meta = {}) =>
  fireAndForget(
    () => axios.post(`${SERVICES.websocket}/api/ws/notify-user`, { userId, type, title, message, meta }),
    `wsNotifyUser(${userId})`
  );

/**
 * Broadcast a ticket-sold event to ALL connected clients (updates seat counts live).
 */
export const wsTicketSold = (eventId, categoryName, remainingSeats) =>
  fireAndForget(
    () => axios.post(`${SERVICES.websocket}/api/ws/ticket-sold`, { eventId, categoryName, remainingSeats }),
    `wsTicketSold(${eventId})`
  );

/**
 * Broadcast dynamic price update to ALL connected clients.
 */
export const wsPriceUpdate = (eventId, prices, occupancyRate) =>
  fireAndForget(
    () => axios.post(`${SERVICES.websocket}/api/ws/price-update`, { eventId, prices, occupancyRate }),
    `wsPriceUpdate(${eventId})`
  );

// ── Email Service ─────────────────────────────────────────────────────────
/**
 * Send a named email template.
 */
export const sendEmailTemplate = (to, templateName, data) =>
  fireAndForget(
    () => axios.post(`${SERVICES.email}/api/email/send-template`, { to, templateName, data }),
    `sendEmailTemplate(${templateName} → ${to})`
  );

/**
 * Send a raw email.
 */
export const sendEmail = (to, subject, html) =>
  fireAndForget(
    () => axios.post(`${SERVICES.email}/api/email/send`, { to, subject, html }),
    `sendEmail(→ ${to})`
  );

// ── Cache Service ─────────────────────────────────────────────────────────
/**
 * Cache a JSON value.
 */
export const cacheSet = (key, value, ttlSeconds) =>
  fireAndForget(
    () => axios.post(`${SERVICES.cache}/api/cache`, { key, value, ttl: ttlSeconds }),
    `cacheSet(${key})`
  );

/**
 * Get a cached value. Returns null on miss or error.
 */
export const cacheGet = async (key) => {
  try {
    const { data } = await axios.get(`${SERVICES.cache}/api/cache/${key}`);
    return data.value;
  } catch {
    return null; // cache miss or service down — caller continues without cache
  }
};

/**
 * Delete a cached value.
 */
export const cacheDel = (key) =>
  fireAndForget(
    () => axios.delete(`${SERVICES.cache}/api/cache/${key}`),
    `cacheDel(${key})`
  );
