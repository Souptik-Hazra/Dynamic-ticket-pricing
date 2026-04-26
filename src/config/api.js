import config from './index';

/**
 * 🛰️ FanFever - API Configuration
 * Consumes values from the centralized config module.
 */

export const API_URL = config.apiBaseUrl;

// API endpoints (paths relative to each service's /api root)
export const ENDPOINTS = {
  // Auth
  LOGIN:          '/auth/signin',
  SIGNUP:         '/auth/signup',
  ME:             '/auth/me',
  REFRESH_TOKEN:  '/auth/refresh',
  UPDATE_PROFILE: '/auth/update-profile',
  LOGOUT:         '/auth/logout',
  VERIFY:         '/auth/verify',

  // Catalog (public) - mounted under `/catalog` on the monolith/gateway
  EVENTS:               '/catalog/events',
  EVENT_BY_ID:          (id) => `/catalog/events/${id}`,
  EVENT_DYNAMIC_PRICES: (id) => `/catalog/events/${id}/dynamic-prices`,

  // Tickets (Organizer Service)
  TICKETS:              '/tickets',
  TICKET_BY_ID:         (id) => `/tickets/${id}`,
  USER_TICKETS:         '/tickets',

  // Admin (Admin Service)
  ADMIN_STATS:       '/admin/stats',
  ADMIN_USERS:       '/admin/users',
  ADMIN_EVENTS:      '/admin/events',
  ADMIN_TICKETS:     '/admin/tickets',
  ADMIN_COMMISSIONS: '/admin/commissions',
  ADMIN_BROADCAST:   '/admin/broadcast',
  ADMIN_AUDIT_LOGS:  '/admin/audit-logs',
  ADMIN_SECURITY_LOGS: '/admin/security-logs',
  PLATFORM_HEALTH:   '/admin/health-all',

  // Analytics (Analytics Service)
  ANALYTICS:           '/analytics',
  ANALYTICS_DASHBOARD: '/analytics/dashboard',

  // Subscription (Subscription Service)
  SUBSCRIPTION:         '/subscription',
  SUBSCRIPTION_PLANS:   '/subscription/plans',
  SUBSCRIPTION_UPGRADE: '/subscription/upgrade',

  // Notifications (Notification Service)
  NOTIFICATIONS:          '/notifications',
  NOTIFICATION_READ:      (id) => `/notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: '/notifications/read-all',
  NOTIFICATION_DELETE:    (id) => `/notifications/${id}`,

  // Payments (Payment Service)
  PAYMENTS:        '/payments',
  PAYMENT_BY_ID:   (id) => `/payments/${id}`,
  PAYMENT_REFUND:  (id) => `/payments/${id}/refund`,

  // ML Model
  ML_PREDICT: (id) => `/ml-model/predict/${id}`,
  ML_HEALTH:  '/ml-model/health',
  // Organizer Service (Messaging & Management)
  ORGANIZER_STATS:         '/organizer/stats',
  ORGANIZER_EVENTS:        '/organizer/events',
  ORGANIZER_TICKETS:       '/organizer/tickets',
  ORGANIZER_BROADCAST:     '/organizer/broadcast',
  ORGANIZER_MESSAGE_ADMIN: '/organizer/message-admin',
  ORGANIZER_SEAT_OWNERS:   (id) => `/organizer/events/${id}/seat-owners`,

  // AI Module
  AI_HEALTH:              '/ai/health',
  AI_PRICES:              (id) => `/ai/prices/${id}`,
  AI_FED_SYNC:            '/ai/federated/sync',
  AI_FED_AGGREGATE:       '/ai/federated/aggregate',
  
  // Scanner / QR
  SCANNER_VERIFY:    '/scanner/verify',
  QR_GENERATE:       '/qr/generate',

  // Wallet Service
  WALLET_BALANCE:    '/wallet/balance',
  WALLET_DEPOSIT:    '/wallet/deposit',
  WALLET_WITHDRAW:   '/wallet/withdraw',
};

// Helper — build full URL via gateway
export const buildUrl = (endpoint) => `${API_URL}${endpoint}`;

// Helper - build WebSocket URL via gateway
export const getWsUrl = () => {
  return config.wsUrl;
};

export default API_URL;
