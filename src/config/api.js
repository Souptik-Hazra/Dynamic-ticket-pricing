const getBaseUrl = () => {
    // Priority 1: Explicit environment variable (Production/Custom Dev)
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl;

    // Priority 2: Standard relative proxy path (Development default)
    return '/api';
};

export const API_URL = getBaseUrl();

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

  // Events (Organizer Service)
  EVENTS:               '/events',
  EVENT_BY_ID:          (id) => `/events/${id}`,
  EVENT_DYNAMIC_PRICES: (id) => `/events/${id}/dynamic-prices`,

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
  ORGANIZER_STATS:         '/organizers/stats',
  ORGANIZER_EVENTS:        '/organizers/events',
  ORGANIZER_TICKETS:       '/organizers/tickets',
  ORGANIZER_BROADCAST:     '/organizers/broadcast',
  ORGANIZER_MESSAGE_ADMIN: '/organizers/message-admin',
  
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
  // Allow overriding via env var for special cases
  const envWs = import.meta.env.VITE_WS_URL;
  if (envWs) return envWs;

  // Prefer connecting to the same origin `/api/ws` so the dev server (Vite)
  // or the API gateway can correctly handle the websocket Upgrade.
  // This avoids attempting to open wss://localhost:4010 directly from an
  // HTTPS page which would fail if the backend doesn't support TLS.
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/api/ws`;
  try { console.debug('[getWsUrl] websocket URL ->', url); } catch (_err) { /* ignore in restricted runtimes */ };
  return url;
};

export default API_URL;
