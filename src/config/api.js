// Centralized API configuration

// API Gateway URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';


// API endpoints (paths relative to each service's /api root)
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/signin',
  SIGNUP: '/auth/signup',
  ME: '/auth/me',
  REFRESH_TOKEN: '/auth/refresh',
  UPDATE_PROFILE: '/auth/update-profile',

  // Events (User Service)
  EVENTS: '/events',
  EVENT_BY_ID: (id) => `/events/${id}`,
  EVENT_DYNAMIC_PRICES: (id) => `/events/${id}/dynamic-prices`,

  // Tickets (Ticket Service)
  TICKETS: '/tickets',
  TICKET_BY_ID: (id) => `/tickets/${id}`,
  USER_TICKETS: '/tickets',

  // Admin (Admin Service)
  ADMIN_EVENTS: '/admin/events',
  ADMIN_EVENT_BY_ID: (id) => `/admin/events/${id}`,
  ADMIN_USERS: '/admin/users',

  // Analytics (Analytics Service)
  ANALYTICS: '/analytics',

  // Subscription (Subscription Service)
  SUBSCRIPTION: '/subscription',

  // ML Model (ML Service)
  ML_PREDICT: '/ml-model/predict',
  ML_HEALTH: '/ml-model/health'
};


// Helper function to build full URL (always uses gateway)
export const buildUrl = (endpoint) => `${API_URL}${endpoint}`;

export default API_URL;
