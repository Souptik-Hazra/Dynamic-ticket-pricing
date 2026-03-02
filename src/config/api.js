// Centralized API configuration
export const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:3443/api';
export const ML_API_URL = import.meta.env.VITE_ML_API_URL || 'http://localhost:5000';

// API endpoints (paths relative to API_URL - do NOT add /api/ prefix)
// Use these constants for all API calls to ensure consistency
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/signin',
  SIGNUP: '/auth/signup',
  ME: '/auth/me',
  REFRESH_TOKEN: '/auth/refresh',
  UPDATE_PROFILE: '/auth/update-profile',
  
  // Events
  EVENTS: '/events',
  EVENT_BY_ID: (id) => `/events/${id}`,
  EVENT_DYNAMIC_PRICES: (id) => `/events/${id}/dynamic-prices`,
  
  // Tickets - unified endpoint
  TICKETS: '/tickets',
  TICKET_BY_ID: (id) => `/tickets/${id}`,
  USER_TICKETS: '/tickets',  // GET with user filter
  
  // Admin
  ADMIN_EVENTS: '/admin/events',
  ADMIN_EVENT_BY_ID: (id) => `/admin/events/${id}`,
  ADMIN_USERS: '/admin/users',
  
  // Analytics
  ANALYTICS: '/analytics',
  
  // Subscription
  SUBSCRIPTION: '/subscription',
  
  // ML Model
  ML_PREDICT: '/ml-model/predict',
  ML_HEALTH: '/ml-model/health'
};

// Helper function to build full URL
export const buildUrl = (endpoint) => `${API_URL}${endpoint}`;

export default API_URL;
