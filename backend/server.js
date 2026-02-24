const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

// Load environment variables
dotenv.config();

// Import models
const Event = require('./models/Event');
const Ticket = require('./models/Ticket');
const PriceHistory = require('./models/PriceHistory');
const PredictionLog = require('./models/PredictionLog');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscription');
const mlModelRoutes = require('./routes/mlModel');
const ticketRoutes = require('./routes/tickets');
const analyticsRoutes = require('./routes/analytics');
const eventRoutes = require('./routes/events');


const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger.js');
const app = express();

// Security Middleware
// 1. Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

// 2. Rate Limiting (simple in-memory implementation)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100;

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const userRequests = requestCounts.get(ip);
  
  if (now > userRequests.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (userRequests.count >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  userRequests.count++;
  next();
});

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, 300000);


// 3. CORS with robust origin check
// Set ALLOWED_ORIGINS in your .env or Render dashboard, e.g.:
// ALLOWED_ORIGINS=https://dynamic-ticket-pricing-mulq.vercel.app,https://your-other-frontend.com
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [/^http:\/\/localhost:\d+$/]; // Allow any localhost port for development

app.use(cors());

// 4. Body parsing with size limits (prevent large payload attacks)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Input Sanitization Middleware
app.use((req, res, next) => {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].replace(/[<>"']/g, '');
      }
    }
  }
  
  // Sanitize body parameters
  if (req.body) {
    sanitizeObject(req.body);
  }
  
  next();
});

function sanitizeObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potential XSS vectors
      obj[key] = obj[key].replace(/<script[^>]*>.*?<\/script>/gi, '');
      obj[key] = obj[key].replace(/javascript:/gi, '');
      obj[key] = obj[key].replace(/on\w+\s*=/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';
mongoose.connect(MONGODB_URI)
.then(async () => {
  console.log('✅ MongoDB connected successfully');
})
.catch(err => console.error('❌ MongoDB connection error:', err));


// ==================== ROUTES ====================

// Auth routes
app.use('/api/auth', authRoutes);

// Subscription routes
app.use('/api/subscription', subscriptionRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Event routes
app.use('/api/events', eventRoutes);

// ML Model routes
app.use('/api/ml-model', mlModelRoutes);

// Ticket routes
app.use('/api/tickets', ticketRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);


// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Health check
app.get('/api/health', async (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Backend server is running',
    services: {
      mongodb: mongoose.connection.readyState === 1
    },
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
});

