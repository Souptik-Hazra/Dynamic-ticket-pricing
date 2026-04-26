import axios from 'axios';
import http from 'http';
import https from 'https';
import axiosRetry from 'axios-retry';

/**
 * 📡 Resilient HTTP Client
 * 
 * Network Concepts:
 * 1. Persistent Keep-Alive: Reuses TCP connections to reduce handshake overhead.
 * 2. Automatic Retries: Exponential backoff for transient 5xx errors.
 * 3. Strict Timeouts: Prevents worker threads from hanging on slow dependencies.
 */

const httpAgent = new http.Agent({ 
  keepAlive: true, 
  maxSockets: 100, 
  freeSocketTimeout: 30000 
});

const httpsAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 100, 
  freeSocketTimeout: 30000 
});

const httpClient = axios.create({
  timeout: 5000, // 5 second hard timeout
  httpAgent,
  httpsAgent,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'FanFever-Monolith/1.0.0'
  }
});

// Configure Retries
axiosRetry(httpClient, { 
  retries: 3, 
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           (error.response && error.response.status >= 500);
  }
});

export default httpClient;
