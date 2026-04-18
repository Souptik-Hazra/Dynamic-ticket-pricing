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
  ml:           process.env.ML_SERVICE_URL           || 'http://localhost:5000',
};

// ── Proxy factory ──────────────────────────────────────────────────────────
const proxy = (target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      error: (err, _req, res) => {
        console.error(`Proxy → ${target}:`, err.message);
        if (!res.headersSent)
          res.status(502).json({ error: 'Service temporarily unavailable' });
      },
    },
  });

// ── Gateway health (not proxied) ──────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', gateway: true }));

// ── Route map (ORDER MATTERS — most specific first) ────────────────────────
//
//  /api/auth/*          → authentication-service :4001
//  /api/users/*         → user-service           :4002
//  /api/admin/*         → admin-service           :4003
//  /api/payments/*      → payment-service         :4004
//  /api/cache/*         → cache-service           :4005
//  /api/lock/*          → concurrency-service     :4006
//  /api/email/*         → email-service           :4007
//  /api/queue/*         → message-queue-service   :4008
//  /api/notifications/* → notification-service    :4009
//  /api/analytics/*     → analytics-service       :4011
//  /api/subscription/*  → subscription-service    :4012
//  /api/events/*        → organizer-service       :4013  (events + dynamic-prices)
//  /api/tickets/*       → organizer-service       :4013  (purchase + user-tickets)
//  /api/organizers/*    → organizer-service       :4013
//  /api/ml-model/*      → ml-service              :5000

app.use('/api/auth',          proxy(SERVICES.auth));
app.use('/api/users',         proxy(SERVICES.user));
app.use('/api/admin',         proxy(SERVICES.admin));
app.use('/api/payments',      proxy(SERVICES.payment));
app.use('/api/cache',         proxy(SERVICES.cache));
app.use('/api/lock',          proxy(SERVICES.concurrency));
app.use('/api/email',         proxy(SERVICES.email));
app.use('/api/queue',         proxy(SERVICES.messageQueue));
app.use('/api/notifications', proxy(SERVICES.notification));
app.use('/api/analytics',     proxy(SERVICES.analytics));
app.use('/api/subscription',  proxy(SERVICES.subscription));
app.use('/api/events',        proxy(SERVICES.organizer));   // includes /:id/dynamic-prices
app.use('/api/tickets',       proxy(SERVICES.organizer));   // purchase + user tickets
app.use('/api/organizers',    proxy(SERVICES.organizer));
app.use('/api/ml-model',      proxy(SERVICES.ml));

// ── 404 catch-all ─────────────────────────────────────────────────────────
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
