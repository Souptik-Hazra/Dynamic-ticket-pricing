// Centralized API configuration

// API Gateway URL
// API Gateway URL
// Auto-detect host to allow mobile devices on same Wi-Fi to reach the API
const getBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    const { hostname } = window.location;
    // If we're on localhost, keep localhost. Otherwise, use the current network hostname/IP.
    const host = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'localhost' : hostname;
    return `http://${host}:3001/api`;
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
  ADMIN_STATS:          '/admin/stats',
  ADMIN_EVENTS:         '/admin/events',
  ADMIN_EVENT_BY_ID:    (id) => `/admin/events/${id}`,
  ADMIN_TICKETS:        '/admin/tickets',
  ADMIN_TICKETS:        '/admin/tickets',
  ADMIN_USERS:          '/admin/users',

  // Analytics (Analytics Service)
  ANALYTICS: '/analytics',

  // Subscription (Subscription Service)
  SUBSCRIPTION:         '/subscription',
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
  ML_PREDICT: '/ml-model/predict',
  ML_HEALTH:  '/ml-model/health',

  // Organizer Dashboard
  ORGANIZER_STATS:   '/organizers/stats',
  ORGANIZER_EVENTS:  '/organizers/events',
  ORGANIZER_TICKETS: '/organizers/tickets',
  SCANNER_VERIFY:    '/scanner/verify',
};

// Helper — build full URL via gateway
export const buildUrl = (endpoint) => `${API_URL}${endpoint}`;

export default API_URL;
