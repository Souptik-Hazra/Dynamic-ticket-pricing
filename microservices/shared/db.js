import mongoose from 'mongoose';

const SHARED_DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

// ── Connection event logging ───────────────────────────────────────────────
mongoose.connection.on('connected',    ()    => console.log('[MongoDB] Connected'));
mongoose.connection.on('disconnected', ()    => console.log('[MongoDB] Disconnected — will auto-reconnect'));
mongoose.connection.on('reconnected',  ()    => console.log('[MongoDB] Reconnected'));
mongoose.connection.on('error',        (err) => console.error('[MongoDB] Connection error:', err.message));

/**
 * Connect to the shared MongoDB database.
 * Mongoose automatically reconnects on transient failures.
 * The service starts regardless — health endpoint still responds.
 */
const connectDB = async (serviceName = 'Service') => {
  try {
    await mongoose.connect(SHARED_DB_URI, {
      serverSelectionTimeoutMS: 5000,   // fail fast at startup if Mongo is down
      socketTimeoutMS:          45000,  // close sockets after 45s of inactivity
      maxPoolSize:              10,     // max concurrent connections per service
    });
    const maskedUri = SHARED_DB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
    console.log(`[${serviceName}] MongoDB connected → ${maskedUri}`);
  } catch (err) {
    // Non-fatal: service starts anyway so /health still responds.
    // Mongoose will keep retrying in the background.
    console.error(`[${serviceName}] MongoDB initial connection failed: ${err.message}`);
    console.warn(`[${serviceName}] Service running without DB — routes will return 503 until reconnected`);
  }
};

/**
 * Middleware: returns 503 if MongoDB is not yet connected.
 * Attach to routes that require DB access:
 *   app.use('/api/some-route', requireDB, handler)
 */
export const requireDB = (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database not available. Please try again shortly.' });
  }
  next();
};

/**
 * Graceful shutdown helper.
 * Call with the HTTP server instance.
 */
export const gracefulShutdown = (server, signal = 'SIGNAL') => {
  console.log(`\n[${signal}] Shutting down gracefully…`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('[MongoDB] Connection closed');
    } catch { /* ignore */ }
    process.exit(0);
  });
  // Force exit if graceful shutdown takes too long
  setTimeout(() => process.exit(1), 10000);
};

/**
 * Register process-level error handlers.
 * Call once per service (pass the HTTP server from app.listen()).
 */
export const registerProcessHandlers = (server, serviceName = 'Service') => {
  process.on('uncaughtException', (err) => {
    console.error(`[${serviceName}] UNCAUGHT EXCEPTION:`, err.message, err.stack);
    gracefulShutdown(server, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error(`[${serviceName}] UNHANDLED REJECTION:`, reason);
    gracefulShutdown(server, 'unhandledRejection');
  });

  process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
  process.on('SIGINT',  ()    => gracefulShutdown(server, 'SIGINT'));
};

/**
 * Align Node.js server timeouts with Nginx/Proxy.
 * Prevents race conditions where backend closes connection before proxy is ready.
 */
export const tuneExpressServer = (server) => {
  // Nginx default is 65s. We set Node higher (70s) to avoid race conditions.
  server.keepAliveTimeout = 70000;
  server.headersTimeout   = 71000;
  console.log('[OS/Network] Server keep-alive timeouts tuned (70s/71s)');
};

export default connectDB;
