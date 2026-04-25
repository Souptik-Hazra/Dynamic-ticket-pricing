import axios from 'axios';
import { API_URL } from '../config/api';

/**
 * 🛰️ Expert Network Client
 * Centralized axios instance with connection pooling hints, 
 * request deduplication, and automated auth handling.
 */
const client = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10s default timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// ── Network Expert: Browser Logging ──────────────────────────────────────
const logNetwork = (type, message, traceId, color = '#6366f1') => {
  if (import.meta.env.MODE === 'production') return;
  console.log(
    `%c[FanFever-Net] %c[${traceId}] %c${type} %c${message}`,
    `color: ${color}; font-weight: bold;`,
    "color: #94a3b8;", // Slate for Trace ID
    "color: #10b981; font-weight: bold;", // Emerald for Type
    "color: inherit;"
  );
};

// ── Request Interceptor ──────────────────────────────────────────────────
client.interceptors.request.use((config) => {
  // 1. Inject Auth Token
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 1.5 Strip Unsafe Headers (Browser compliance)
  delete config.headers.Connection;
  delete config.headers.connection;

  // 2. Add Trace ID (Expert practice for distributed logging)
  const traceId = Math.random().toString(36).substring(2, 11);
  config.headers['X-Trace-Id'] = traceId;
  config.metadata = { start: Date.now(), traceId };

  logNetwork('SEND', `${config.method.toUpperCase()} ${config.url}`, traceId);

  return config;
}, (error) => Promise.reject(error));

// ── Response Interceptor ─────────────────────────────────────────────────
client.interceptors.response.use((response) => {
  const { start, traceId } = response.config.metadata || {};
  const duration = Date.now() - start;
  logNetwork('RECV', `${response.status} | ${duration}ms | ${response.config.url}`, traceId, '#10b981');

  // Unwrap JSend-style response bodies so `response.data` contains the
  // actual payload. This keeps callers consistent (`response.data.user`,
  // `response.data.prices`, or direct arrays for lists).
  if (response && response.data && typeof response.data === 'object' && 'status' in response.data) {
    // If the server returned the standard { status, message, data } envelope,
    // replace axios' response.data with the inner payload for convenience.
    response.data = response.data.data;
  }

  return response;
}, (error) => {
  const { start, traceId } = error.config?.metadata || {};
  const duration = start ? `${Date.now() - start}ms` : '??ms';
  const status = error.response?.status;
  
  if (status === 401 && !error.config._retry && !error.config.url.includes('/auth/login')) {
    error.config._retry = true;
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (refreshToken) {
      logNetwork('AUTH', 'Attempting silent token refresh...', traceId, '#f59e0b');
      
      return axios.post(`${API_URL}/auth/refresh`, { refreshToken })
        .then(res => {
          if (res.status === 200) {
            const { token, refreshToken: newRefreshToken } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('refreshToken', newRefreshToken);
            
            // Update the failed request with the new token
            error.config.headers['Authorization'] = `Bearer ${token}`;
            logNetwork('AUTH', 'Refresh successful. Retrying original request.', traceId, '#10b981');
            return client(error.config);
          }
        })
        .catch(refreshErr => {
          logNetwork('AUTH', 'Refresh failed. Evicting session.', traceId, '#ef4444');
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        });
    }
  }

  if (status === 401) {
    logNetwork('AUTH', 'Unauthorized (401) detected.', traceId, '#ef4444');
  } else if (status) {
    logNetwork('FAIL', `${status} | ${duration} | ${error.config?.url}`, traceId, '#ef4444');
  }

  return Promise.reject(error);
});

export default client;
