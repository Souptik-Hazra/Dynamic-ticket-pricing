import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import cluster from 'cluster';
import os from 'os';
import rateLimit from 'express-rate-limit';

import { connectMongoDB, connectNeo4j } from './src/shared/database.js';
import { requestLogger } from './src/shared/logger.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import { botShield } from './src/middleware/botShield.js';

import authRoutes from './src/modules/auth/auth.routes.js';
import userRoutes from './src/modules/users/user.routes.js';
import organizerRoutes from './src/modules/organizer/organizer.routes.js';
import ticketRoutes from './src/modules/tickets/ticket.routes.js';
import paymentRoutes from './src/modules/payments/payment.routes.js';
import notificationRoutes, { handleWsConnection, startWsHeartbeat } from './src/modules/notifications/notification.routes.js';
import aiRoutes from './src/modules/ai/ai.routes.js';
import analyticsRoutes from './src/modules/analytics/analytics.routes.js';
import adminRoutes from './src/modules/admin/admin.routes.js';
import subscriptionRoutes from './src/modules/subscriptions/subscription.routes.js';
import emailRoutes from './src/modules/email/email.routes.js';
import catalogRoutes from './src/modules/catalog/catalog.routes.js';
import { initAutomation } from './src/shared/automation.js';

// Load environment variables
// (Already loaded at top)

const app = express();
const httpServer = createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── ML Model Lifecycle (Self-Healing Supervisor) ───────────────────────────
let mlApp;
const startMLModel = () => {
  console.log('🤖 Starting ML Model sidecar...');
  const pythonPath = process.env.PYTHON_PATH || 'python';
  mlApp = spawn(pythonPath, ['app.py'], {
    cwd: path.join(__dirname, 'ml-model'),
    stdio: 'inherit',
    shell: true
  });

  mlApp.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`🚩 ML Model crashed (code ${code}). Respawning in 3s...`);
      setTimeout(startMLModel, 3000);
    }
  });

  return mlApp;
};

if (cluster.isPrimary) {
  startMLModel();
  // Automation runs only on Primary process to avoid redundant tasks
  connectMongoDB().then(() => {
    initAutomation();
  });
}

// ── Clustering Strategy (Multi-Core Scaling) ───────────────────────────────
const numCPUs = os.cpus().length;
const MEM_LIMIT = os.totalmem() * 0.8; // Recycle at 80% RAM usage

if (cluster.isPrimary && (process.env.NODE_ENV === 'production' || process.env.CLUSTER_DEV === 'true')) {
  console.log(`[Monolith Master] 🚀 Spawning ${numCPUs} workers for multi-core scaling...`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on('exit', (worker) => {
    console.error(`[Monolith Master] 🚩 Worker ${worker.process.pid} died. Respawning...`);
    cluster.fork();
  });
} else if (cluster.isWorker || !cluster.isPrimary || process.env.NODE_ENV !== 'production') {
  // Initialize WebSocket Server
  const wss = new WebSocketServer({ server: httpServer, path: '/api/ws' });
  wss.on('connection', handleWsConnection);
  const heartbeatInterval = startWsHeartbeat(wss);

  // ── Database Initialization ──
  connectMongoDB();
  connectNeo4j();

  // ── Global Middlewares ──
  app.use(botShield);
  app.use(helmet());
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger(`Worker-${process.pid}`));

  // ── Rate Limiters ──
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many auth attempts. Try again in 15 minutes.' } });
  const purchaseLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 10, message: { error: 'Transaction frequency exceeded. Cooling down.' } });
  const generalLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 120 });

  // ── Module Registry (The Heart of the Monolith) ──────────────────────────
  app.get('/health', (req, res) => res.json({ status: 'healthy', worker: process.pid, memory: process.memoryUsage(), ts: new Date().toISOString() }));
  
  const moduleRegistry = [
    { path: '/api/auth', router: authRoutes, limiter: authLimiter },
    { path: '/api/users', router: userRoutes },
    { path: '/api/catalog', router: catalogRoutes },
    { path: '/api/events', router: catalogRoutes }, // Alias for legacy/public discovery
    { path: '/api/organizer', router: organizerRoutes },
    { path: '/api/organizers', router: organizerRoutes }, // Restore plural alias
    { path: '/api/tickets', router: ticketRoutes, limiter: purchaseLimiter },
    { path: '/api/scanner', router: ticketRoutes, limiter: purchaseLimiter },
    { path: '/api/qr', router: ticketRoutes, limiter: purchaseLimiter },
    { path: '/api/payments', router: paymentRoutes, limiter: purchaseLimiter },
    { path: '/api/wallet', router: paymentRoutes, limiter: purchaseLimiter },
    { path: '/api/notifications', router: notificationRoutes },
    { path: '/api/ai', router: aiRoutes },
    { path: '/api/ml-model', router: aiRoutes },
    { path: '/api/analytics', router: analyticsRoutes },
    { path: '/api/admin', router: adminRoutes },
    { path: '/api/subscription', router: subscriptionRoutes },
    { path: '/api/email', router: emailRoutes }
  ];

  moduleRegistry.forEach(({ path, router, limiter }) => {
    const middleware = [limiter || generalLimiter, router];
    app.use(path, ...middleware);
  });

  // ── Production Frontend Serving ──
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  // Fallback for SPA routing: serve index.html for unknown non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) 
        return next(); // Pass to 404 handler if dist doesn't exist
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  // ── Systems Sentinels ──
  setInterval(() => {
    const usage = process.memoryUsage();
    const memoryLimit = parseInt(process.env.MAX_WORKER_MEMORY_MB || '1024') * 1024 * 1024;
    if (usage.heapUsed > memoryLimit) {
      console.warn(`🚩 Worker ${process.pid} exceeding memory limit (${Math.round(usage.heapUsed/1024/1024)}MB). Graceful restart triggered.`);
      process.exit(1);
    }
  }, 30000);

  const PORT = process.env.PORT || 4000;
  
  // ── Smart Local Trust (Development) ──
  const devOrigin = (origin, callback) => {
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',');
    if (allowed.includes('*') || allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  };

  app.use(cors({ 
    origin: process.env.NODE_ENV === 'production' ? (process.env.ALLOWED_ORIGINS || '').split(',') : devOrigin, 
    credentials: true 
  }));

  httpServer.listen(PORT, () => console.log(`🚀 Worker ${process.pid} | Monolith running on port ${PORT}`))
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ PORT ${PORT} IS BUSY. Change it in .env or kill the process using it.`);
        process.exit(1);
      }
    });

  // ── Graceful Shutdown ──
  const shutdown = () => {
    clearInterval(heartbeatInterval);
    httpServer.close(() => {
      console.log(`👋 Worker ${process.pid} shutdown complete.`);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref(); // Force exit if stuck
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { app };
