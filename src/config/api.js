// Centralized API configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const ML_API_URL = import.meta.env.VITE_ML_API_URL || 'http://localhost:5000';

// API endpoints (paths relative to API_URL - do NOT add /api/ prefix)
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  
  // Events
  EVENTS: '/events',
  EVENT_BY_ID: (id) => `/events/${id}`,
  
  // Tickets
  TICKETS: '/tickets',
  USER_TICKETS: '/tickets/user',
  PURCHASE_TICKET: '/tickets/purchase',
  
  // Admin
  ADMIN_EVENTS: '/admin/events',
  ADMIN_EVENT_BY_ID: (id) => `/admin/events/${id}`,
  ADMIN_USERS: '/admin/users',
  
  // Analytics
  ANALYTICS: '/analytics',
  
  // Price Prediction
  PREDICT_PRICE: '/predict-price'
};

export default API_URL;
