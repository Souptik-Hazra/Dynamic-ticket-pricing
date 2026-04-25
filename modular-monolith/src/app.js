import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';

// Middleware
import { errorHandler } from './middleware/error.js';
import { apiLimiter, authLimiter } from './middleware/rateLimiter.js';

// Modules
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import catalogRoutes from './modules/catalog/catalog.routes.js';
import organizerRoutes from './modules/organizer/organizer.routes.js';
import ticketRoutes from './modules/tickets/ticket.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import subscriptionRoutes from './modules/subscriptions/subscription.routes.js';
import emailRoutes from './modules/email/email.routes.js';
import { setupSwagger } from './shared/utils/swagger.js';
import { botShield } from './middleware/botShield.js';

export function createApp() {
  const app = express();

  // Basic Middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));

  // Global Security Shield
  app.use(botShield);

  // Global Rate Limiter
  app.use('/api', apiLimiter);

  // Setup API Documentation
  setupSwagger(app);

  // Health Check
  app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

  // ── API Versioning (v1) ──
  const v1Router = express.Router();

  v1Router.use('/auth', authLimiter, authRoutes);
  v1Router.use('/users', userRoutes);
  v1Router.use('/catalog', catalogRoutes);
  v1Router.use('/organizer', organizerRoutes);
  v1Router.use('/tickets', ticketRoutes);
  v1Router.use('/payments', paymentRoutes);
  v1Router.use('/notifications', notificationRoutes);
  v1Router.use('/ai', aiRoutes);
  v1Router.use('/analytics', analyticsRoutes);
  v1Router.use('/admin', adminRoutes);
  v1Router.use('/subscriptions', subscriptionRoutes);
  v1Router.use('/email', emailRoutes);

  app.use('/api/v1', v1Router);

  // Backward compatibility (Optional, but recommended for transition)
  app.use('/api', v1Router);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export function createHttpServer(app) {
  return createServer(app);
}
