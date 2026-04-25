import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import compression from 'compression';
import http from 'http';
import { tuneExpressServer } from '../shared/db.js';
import { requestLogger } from '../shared/logger.js';
import { botShield } from './botShield.js';
import cluster from 'cluster';
import os from 'os';

dotenv.config();

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`[OS Expert] 🚀 API Gateway Master [${process.pid}] starting...`);
  // console.log(`[OS Expert] 🏁 Spawning ${numCPUs} workers for multi-core scaling...`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`[OS Expert] 🚩 Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Spawning replacement...`);
    cluster.fork();
  });
} else {
  const app = express();
  // console.log(`[OS Expert] 🏗️ Worker ${workerId} [${process.pid}] online`);
  // ── Bot Protection ──────────────────────────────────────────────────────────
  app.use(botShield);
  // Increase listener limit for the 14+ proxied microservices
  app.setMaxListeners(20);

  // ── Global Middleware ──────────────────────────────────────────────────────
  // CORS MUST be first to handle preflight (OPTIONS) requests correctly.
  // When credentials:true, we cannot use wildcard '*'. We reflect the Origin header.
  const allowedOrigins = process.env.ALLOWED_ORIGINS === '*' ? true : (process.env.ALLOWED_ORIGINS || '').split(',');

  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  app.use(compression()); // Compress responses to save bandwidth
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:5173', 'https://localhost:5173'],
        fontSrc: ["'self'", 'https:'],
      },
    },
  }));

  // 1. Global Rate limiting — prevents brute force/DDoS
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Balanced for SPA navigation
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again after 15 minutes' },
  });

  // 2. Hardened Pricing Limiter — prevents price scraping & "hunting"
  const pricingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300, // accommodate polling for multiple events
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Price lookup limit exceeded. Please wait 15 minutes.' },
    skipSuccessfulRequests: false,
  });

  app.use('/api', globalLimiter);
  app.use('/api/events/:id/dynamic-prices', pricingLimiter);

  // ── Network Expert: Heavy Logging Middleware ────────────────────────────────
  app.use(requestLogger('APIGateway'));

  // ── Service registry ───────────────────────────────────────────────────────
  const SERVICES = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
    user: process.env.USER_SERVICE_URL || 'http://localhost:4002',
    admin: process.env.ADMIN_SERVICE_URL || 'http://localhost:4003',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4004',
    cache: process.env.CACHE_SERVICE_URL || 'http://localhost:4005',
    email: process.env.EMAIL_SERVICE_URL || 'http://localhost:4007',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4009',
    websocket: process.env.WEBSOCKET_SERVICE_URL || 'http://localhost:4010',
    analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4011',
    subscription: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:4012',
    organizer: process.env.ORGANIZER_SERVICE_URL || 'http://localhost:4013',
    qr: process.env.QR_SERVICE_URL || 'http://localhost:4014',
    scanner: process.env.SCANNER_SERVICE_URL || 'http://localhost:4015',
    wallet: process.env.WALLET_SERVICE_URL || 'http://localhost:4016',
    ml: process.env.ML_SERVICE_URL || 'http://localhost:5000',
  };

  // ── Persistent Connection Pooling ──────────────────────────────────────────
  // Reuses TCP connections between Gateway and Microservices
  const keepAliveAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 60000, // 1 minute socket timeout
  });

  // ── Proxy factory ──────────────────────────────────────────────────────────
  // Using the explicit configuration object for http-proxy-middleware v3
  const proxy = (path, target, extraOptions = {}) =>
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathFilter: path,
      ws: true, // Enable websocket proxying correctly for Upgrade headers
      agent: keepAliveAgent, // Use our persistent pool
      ...extraOptions,
      on: {
        error: (err, _req, res) => {
          console.error(`Proxy → ${target} (path: ${path}):`, err.message);
          if (res.headersSent === false && typeof res.status === 'function')
            res.status(502).json({ error: 'Service temporarily unavailable' });
        },
      },
    });

  // ── Gateway health (not proxied) ──────────────────────────────────────────
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', gateway: true }));

  // ── Route map ──────────────────────────────────────────────────────────────
  // API Expert: Supports both legacy /api/ and modern /api/v1/ prefixes
  const v1 = (p) => [p, p.replace('/api/', '/api/v1/')];

  app.use(proxy(v1('/api/auth'), SERVICES.auth));
  app.use(proxy(v1('/api/users'), SERVICES.user));
  app.use(proxy(v1('/api/admin'), SERVICES.admin));
  app.use(proxy(v1('/api/payments'), SERVICES.payment));
  app.use(proxy(v1('/api/cache'), SERVICES.cache));
  app.use(proxy(v1('/api/email'), SERVICES.email));
  app.use(proxy(v1('/api/notifications'), SERVICES.notification));
  app.use(proxy(v1('/api/analytics'), SERVICES.analytics));
  app.use(proxy(v1('/api/subscription'), SERVICES.subscription));
  app.use(proxy(v1('/api/events'), SERVICES.organizer));
  app.use(proxy(v1('/api/tickets'), SERVICES.organizer));
  app.use(proxy(v1('/api/organizers'), SERVICES.organizer));
  app.use(proxy(v1('/api/security'), SERVICES.organizer));
  // Simulator endpoints (Neo4j-backed) — forward to Organizer service
  app.use(proxy(v1('/api/simulator'), SERVICES.organizer));
  app.use(proxy(v1('/api/qr'), SERVICES.qr));
  app.use(proxy(v1('/api/scanner'), SERVICES.scanner));
  app.use(proxy(v1('/api/wallet'), SERVICES.wallet));

  // ── WebSocket Proxy (Direct Upgrade support) ──────────────────────────────
  const wsProxy = proxy(v1('/api/ws'), SERVICES.websocket);
  app.use(wsProxy);

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

  // ── Platform Health Aggregation ──────────────────────────────────────────
  app.get('/api/health-all', async (_req, res) => {
    const reports = {};
    const serviceCheck = async (name, url) => {
      try {
        const start = Date.now();
        const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        const latency = Date.now() - start;
        if (response.ok) {
          const data = await response.json();
          reports[name] = { ...data, status: 'online', latency: `${latency}ms` };
        } else {
          reports[name] = { status: 'error', code: response.status };
        }
      } catch (err) {
        reports[name] = { status: 'offline', error: err.message };
      }
    };

    await Promise.all(Object.entries(SERVICES).map(([name, url]) => serviceCheck(name, url)));
    res.json({ gateway: 'online', timestamp: new Date(), services: reports });
  });

  const PORT = process.env.PORT_API_GATEWAY || 3001;
  const server = app.listen(PORT, '0.0.0.0', () => console.log(`API Gateway running on port ${PORT} (Network Exposed)`));

  // Raise listener limit: each of the 15+ proxy middlewares adds a 'close' listener
  server.setMaxListeners(30);

  // Apply OS/Network tuning to the server instance
  tuneExpressServer(server);

  // ── WebSocket Upgrade Handler ─────────────────────────────────────────────
  // Manually forward 'upgrade' events to the WebSocket proxy
  server.on('upgrade', (req, socket, head) => {
      try {
        console.log('[APIGateway] upgrade event:', { url: req.url, headers: { upgrade: req.headers.upgrade, host: req.headers.host } });
      } catch (e) {}
      if (req.url?.startsWith('/api/ws')) {
        try {
          wsProxy.upgrade(req, socket, head);
        } catch (err) {
          console.error('[APIGateway] wsProxy.upgrade failed:', err && err.message);
          try { socket.destroy(); } catch {};
        }
      }
    });
}
