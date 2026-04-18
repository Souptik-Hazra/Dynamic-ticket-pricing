import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
dotenv.config();

const app = express();

// CORS must be declared before proxy middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
  credentials: true,
}));

// ── Service registry ───────────────────────────────────────────────────────
const SERVICES = {
  auth:         process.env.AUTH_SERVICE_URL         || 'http://localhost:4001',
  user:         process.env.USER_SERVICE_URL         || 'http://localhost:4002',
  admin:        process.env.ADMIN_SERVICE_URL        || 'http://localhost:4003',
  payment:      process.env.PAYMENT_SERVICE_URL      || 'http://localhost:4004',
  cache:        process.env.CACHE_SERVICE_URL        || 'http://localhost:4005',
  concurrency:  process.env.CONCURRENCY_SERVICE_URL  || 'http://localhost:4006',
  email:        process.env.EMAIL_SERVICE_URL        || 'http://localhost:4007',
  messageQueue: process.env.MESSAGE_QUEUE_SERVICE_URL|| 'http://localhost:4008',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4009',
  websocket:    process.env.WEBSOCKET_SERVICE_URL    || 'http://localhost:4010',
  analytics:    process.env.ANALYTICS_SERVICE_URL    || 'http://localhost:4011',
  subscription: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:4012',
  organizer:    process.env.ORGANIZER_SERVICE_URL    || 'http://localhost:4013',
  qr:           process.env.QR_SERVICE_URL           || 'http://localhost:4014',
  scanner:      process.env.SCANNER_SERVICE_URL      || 'http://localhost:4015',
  wallet:       process.env.WALLET_SERVICE_URL       || 'http://localhost:4016',
  ml:           process.env.ML_SERVICE_URL           || 'http://localhost:5000',
};

// ── Proxy factory ──────────────────────────────────────────────────────────
// Using the explicit configuration object for http-proxy-middleware v3
const proxy = (path, target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: path,
    on: {
      error: (err, _req, res) => {
        console.error(`Proxy → ${target} (path: ${path}):`, err.message);
        if (!res.headersSent)
          res.status(502).json({ error: 'Service temporarily unavailable' });
      },
    },
  });

// ── Gateway health (not proxied) ──────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', gateway: true }));

// ── Route map ──────────────────────────────────────────────────────────────
// Note: We use the proxy middleware directly to ensure URL prefixes are NOT stripped
app.use(proxy('/api/auth',          SERVICES.auth));
app.use(proxy('/api/users',         SERVICES.user));
app.use(proxy('/api/admin',         SERVICES.admin));
app.use(proxy('/api/payments',      SERVICES.payment));
app.use(proxy('/api/cache',         SERVICES.cache));
app.use(proxy('/api/lock',          SERVICES.concurrency));
app.use(proxy('/api/email',         SERVICES.email));
app.use(proxy('/api/queue',         SERVICES.messageQueue));
app.use(proxy('/api/notifications', SERVICES.notification));
app.use(proxy('/api/analytics',     SERVICES.analytics));
app.use(proxy('/api/subscription',  SERVICES.subscription));
app.use(proxy('/api/events',        SERVICES.organizer));
app.use(proxy('/api/tickets',       SERVICES.organizer));
app.use(proxy('/api/organizers',    SERVICES.organizer));
app.use(proxy('/api/qr',            SERVICES.qr));
app.use(proxy('/api/scanner',       SERVICES.scanner));
app.use(proxy('/api/wallet',        SERVICES.wallet));

// ── ML Model (Special case: strips prefix) ─────────────────────────────────
app.use(
  createProxyMiddleware({
    target: SERVICES.ml,
    changeOrigin: true,
    pathFilter: '/api/ml-model',
    pathRewrite: { '^/api/ml-model': '' },
    on: {
      error: (err, _req, res) => {
        console.error(`Proxy → ML Model:`, err.message);
        if (!res.headersSent)
          res.status(502).json({ error: 'Service temporarily unavailable' });
      },
    },
  })
);

// ── 404 catch-all ─────────────────────────────────────────────────────────
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

const PORT = process.env.PORT_API_GATEWAY || process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`API Gateway running on port ${PORT} (Network Exposed)`));
