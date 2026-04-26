import config from './src/shared/config/index.js';

import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import cluster from 'cluster';
import os from 'os';
import { execSync } from 'child_process';

import { connectMongoDB, connectNeo4j } from './src/shared/db/index.js';
import { createApp, createHttpServer } from './src/app.js';
import { handleWsConnection, startWsHeartbeat } from './src/modules/notifications/notification.ws.js';
import { initNotificationBus } from './src/modules/notifications/notification.bus.js';
import { initGraphSync } from './src/modules/analytics/graph.sync.js';
import { initStatsSync } from './src/modules/admin/service/stats.service.js';
import { initMLScheduler } from './src/modules/ai/service/ml.scheduler.js';
import { initAutomation } from './src/shared/utils/automation.js';
import { initBigDataPipeline } from './src/shared/utils/bigData.service.js';
import { initBroadcaster } from './src/shared/utils/broadcaster.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── ML Model Lifecycle (Self-Healing Supervisor) ───────────────────────────
let mlApp;
const startMLModel = () => {
  console.log('🤖 [Master] Starting ML Model sidecar...');
  const pythonPath = process.env.PYTHON_PATH || 'python';
  
  try {
    mlApp = spawn(pythonPath, ['app.py'], {
      cwd: path.join(__dirname, 'ml-model'),
      stdio: 'inherit',
      shell: process.platform === 'win32' // Robust shell spawning on Windows
    });

    mlApp.on('error', (err) => {
      console.error(`❌ [Master] Failed to start ML Model: ${err.message}`);
      if (err.code === 'ENOENT') {
        console.error(`💡 Suggestion: Ensure "${pythonPath}" is in your PATH or update PYTHON_PATH in .env`);
      }
    });

    mlApp.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`🚩 [Master] ML Model crashed (code ${code}). Respawning in 5s...`);
        setTimeout(startMLModel, 5000);
      }
    });
  } catch (err) {
    console.error(`❌ [Master] Critical error spawning ML sidecar: ${err.message}`);
  }

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
const getWorkerCount = () => {
  const envCount = parseInt(process.env.CPU_CLUSTERS);
  const totalCPUs = os.cpus().length;
  
  if (!isNaN(envCount) && envCount > 0) return Math.min(envCount, totalCPUs);
  if (process.env.NODE_ENV === 'production') return totalCPUs;
  
  // OS Expert Tip: In dev, don't saturate all cores. Use 2 or 50% of cores.
  return Math.min(2, totalCPUs);
};

if (cluster.isPrimary && (process.env.NODE_ENV === 'production' || process.env.CLUSTER_DEV === 'true')) {
  const numWorkers = getWorkerCount();
  console.log(`[Monolith Master] 🚀 Spawning ${numWorkers} workers for multi-core scaling...`);
  
  for (let i = 0; i < numWorkers; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    if (signal) {
      console.log(`[Monolith Master] Worker ${worker.process.pid} was killed by signal: ${signal}`);
    } else if (code !== 0) {
      console.error(`[Monolith Master] 🚩 Worker ${worker.process.pid} died (code ${code}). Respawning...`);
      cluster.fork();
    } else {
      console.log(`[Monolith Master] Worker ${worker.process.pid} exited gracefully.`);
    }
  });

  // Cleanup sidecar on master exit
  process.on('SIGINT', () => {
    console.log('\n🛑 [Master] Shutting down systems...');
    if (mlApp) mlApp.kill();
    process.exit(0);
  });
} else if (cluster.isWorker || !cluster.isPrimary || process.env.NODE_ENV !== 'production') {
  // OS Concept: Process Priority Scheduling
  // Ensure worker processes handling requests have Normal priority.
  try {
    os.setPriority(process.pid, os.constants.priority.PRIORITY_NORMAL);
  } catch (err) {
    // Ignore if permission denied
  }

  const app = createApp();

  const httpServer = createHttpServer(app);

  // OS/Network Concept: Anti-Slowloris Protection
  // Limits how long the server waits for headers and request bodies.
  // Prevents "Low and Slow" attacks from exhausting the connection pool.
  httpServer.headersTimeout = 10000; // 10 seconds
  httpServer.requestTimeout = 30000; // 30 seconds
  httpServer.keepAliveTimeout = 65000; // Slightly more than typical ELB/Nginx timeout


  // Initialize WebSocket Server
  const wss = new WebSocketServer({ server: httpServer, path: '/api/ws' });
  wss.on('connection', handleWsConnection);
  const heartbeatInterval = startWsHeartbeat(wss);
  initNotificationBus();
  initGraphSync();
  initStatsSync();
  initMLScheduler();
  initBigDataPipeline();
  initBroadcaster();

  // ── Database Initialization & Startup ──
  const start = async () => {
    try {
      await connectMongoDB();
      connectNeo4j();

      const PORT = config.port;
      httpServer.listen(PORT, () => console.log(`🚀 Worker ${process.pid} | Monolith running on port ${PORT}`))
        .on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`❌ PORT ${PORT} IS BUSY. Change it in .env or kill the process using it.`);
            process.exit(1);
          }
        });
    } catch (err) {
      console.error(`❌ Worker ${process.pid} failed to start:`, err.message);
      process.exit(1);
    }
  };

  start();

  // ── Systems Sentinels ──
  setInterval(() => {
    const usage = process.memoryUsage();
    const memoryLimit = config.clustering.maxWorkerMemoryMb * 1024 * 1024;
    if (usage.heapUsed > memoryLimit) {
      console.warn(`🚩 Worker ${process.pid} exceeding memory limit (${Math.round(usage.heapUsed/1024/1024)}MB). Graceful restart triggered.`);
      process.exit(1);
    }
  }, 30000);

  // ── Graceful Shutdown (OS Context: Resource Cleanup) ──
  const shutdown = async (signal) => {
    console.log(`\n🛑 [Worker ${process.pid}] Received ${signal}. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    httpServer.close(async () => {
      try {
        clearInterval(heartbeatInterval);
        
        // Disconnect from databases in reverse order
        const { closeNeo4j } = await import('./src/shared/db/index.js');
        await closeNeo4j().catch(() => null);
        
        console.log(`👋 Worker ${process.pid} shutdown complete.`);
        process.exit(0);
      } catch (err) {
        console.error(`❌ Shutdown error: ${err.message}`);
        process.exit(1);
      }
    });

    // Force exit if shutdown takes too long (Backstop)
    setTimeout(() => {
      console.error('🚩 Shutdown timed out, forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

