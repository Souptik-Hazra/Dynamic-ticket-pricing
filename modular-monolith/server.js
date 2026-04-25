import dotenv from 'dotenv';
dotenv.config();

import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import cluster from 'cluster';
import os from 'os';

import { connectMongoDB, connectNeo4j } from './src/shared/db/index.js';
import { createApp, createHttpServer } from './src/app.js';
import { handleWsConnection, startWsHeartbeat } from './src/modules/notifications/notification.ws.js';
import { initNotificationBus } from './src/modules/notifications/notification.bus.js';
import { initGraphSync } from './src/modules/analytics/graph.sync.js';
import { initStatsSync } from './src/modules/admin/service/stats.service.js';
import { initMLScheduler } from './src/modules/ai/service/ml.scheduler.js';
import { initAutomation } from './src/shared/utils/automation.js';

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
  
  // Connect to DB and run any master-only initialization if needed
  connectMongoDB().then(() => {
    console.log('✅ [Master] MongoDB connected');
    initAutomation();
  });
}

// ── Clustering Strategy (Multi-Core Scaling) ───────────────────────────────
const numCPUs = os.cpus().length;

if (cluster.isPrimary && (process.env.NODE_ENV === 'production' || process.env.CLUSTER_DEV === 'true')) {
  console.log(`[Monolith Master] 🚀 Spawning ${numCPUs} workers for multi-core scaling...`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on('exit', (worker) => {
    console.error(`[Monolith Master] 🚩 Worker ${worker.process.pid} died. Respawning...`);
    cluster.fork();
  });
} else if (cluster.isWorker || !cluster.isPrimary || process.env.NODE_ENV !== 'production') {
  const app = createApp();
  const httpServer = createHttpServer(app);

  // Initialize WebSocket Server
  const wss = new WebSocketServer({ server: httpServer, path: '/api/ws' });
  wss.on('connection', handleWsConnection);
  const heartbeatInterval = startWsHeartbeat(wss);
  initNotificationBus();
  initGraphSync();
  initStatsSync();
  initMLScheduler();

  // ── Database Initialization ──
  connectMongoDB();
  connectNeo4j();

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
