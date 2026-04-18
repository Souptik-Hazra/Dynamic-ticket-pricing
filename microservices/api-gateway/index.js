import dotenv from 'dotenv';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Service URLs (edit ports as needed)
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  user: process.env.USER_SERVICE_URL || 'http://localhost:4002',
  admin: process.env.ADMIN_SERVICE_URL || 'http://localhost:4003',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4004',
  ticket: process.env.TICKET_SERVICE_URL || 'http://localhost:4005',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4006',
  subscription: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:4007',
  ml: process.env.ML_SERVICE_URL || 'http://localhost:5000',
};

// Health endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok', gateway: true }));

// Proxy rules
app.use('/api/auth', createProxyMiddleware({ target: SERVICES.auth, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));
app.use('/api/users', createProxyMiddleware({ target: SERVICES.user, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));
app.use('/api/events', createProxyMiddleware({ target: SERVICES.user, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));
app.use('/api/tickets', createProxyMiddleware({ target: SERVICES.ticket, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));
app.use('/api/admin', createProxyMiddleware({ target: SERVICES.admin, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));
app.use('/api/payment', createProxyMiddleware({ target: SERVICES.payment, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));
app.use('/api/analytics', createProxyMiddleware({ target: SERVICES.analytics, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));
app.use('/api/subscription', createProxyMiddleware({ target: SERVICES.subscription, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));
app.use('/api/ml-model', createProxyMiddleware({ target: SERVICES.ml, changeOrigin: true, pathRewrite: { '^/api': '/api' } }));

// Fallback for unknown routes
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found in gateway' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
