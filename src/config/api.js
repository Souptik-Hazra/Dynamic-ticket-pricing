// Centralized API configuration
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const ML_API_URL = import.meta.env.VITE_ML_API_URL || 'http://localhost:5000';

// API endpoints
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  
  // Events
  EVENTS: '/api/events',
  EVENT_BY_ID: (id) => `/api/events/${id}`,
  
  // Tickets
  TICKETS: '/api/tickets',
  USER_TICKETS: '/api/tickets/user',
  PURCHASE_TICKET: '/api/tickets/purchase',
  
  // Admin
  ADMIN_EVENTS: '/api/admin/events',
  ADMIN_EVENT_BY_ID: (id) => `/api/admin/events/${id}`,
  ADMIN_USERS: '/api/admin/users',
  
  // Analytics
  ANALYTICS: '/api/analytics',
  
  // Price Prediction
  PREDICT_PRICE: '/api/predict-price'
};

export default API_URL;
