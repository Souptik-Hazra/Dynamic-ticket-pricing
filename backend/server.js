const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import models
const Event = require('./models/Event');
const Ticket = require('./models/Ticket');
const PriceHistory = require('./models/PriceHistory');
const PredictionLog = require('./models/PredictionLog');

// Import services for initialization
const cacheService = require('./services/cacheService');
const concurrencyService = require('./services/concurrencyService');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscription');
const mlModelRoutes = require('./routes/mlModel');
const ticketRoutes = require('./routes/tickets');
const analyticsRoutes = require('./routes/analytics');
const eventRoutes = require('./routes/events');

const app = express();

// ==================== SECURITY MIDDLEWARE ====================

// 1. HTTPS Enforcement (production only)
// Redirects HTTP to HTTPS when behind a proxy (Heroku, Render, etc.)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Check for HTTPS via X-Forwarded-Proto header (set by reverse proxy)
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
  
  // Set security headers
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// Trust proxy for accurate IP detection (required for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// 2. Rate Limiting with express-rate-limit (works across instances if using Redis store)
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
});

// Stricter limiter for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown'
});

// Apply general rate limiting to all routes
app.use('/api/', apiLimiter);

// Apply stricter rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);


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
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// Robust string sanitization that handles obfuscation attempts
function sanitizeString(str) {
  let prev;
  let current = str;
  
  // Keep sanitizing until no more changes (handles nested obfuscation like <scr<script>ipt>)
  do {
    prev = current;
    
    // Remove all HTML tags (not just script)
    current = current.replace(/<[^>]*>/gi, '');
    
    // Remove javascript: protocol (with possible whitespace/encoding)
    current = current.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '');
    
    // Remove event handlers (onclick, onerror, onload, etc.)
    current = current.replace(/on\w+\s*=/gi, '');
    
    // Remove data: URLs that could contain scripts
    current = current.replace(/data\s*:\s*text\/html/gi, '');
    
    // Remove expression() CSS function (IE)
    current = current.replace(/expression\s*\(/gi, '');
    
    // Remove vbscript: protocol
    current = current.replace(/vbscript\s*:/gi, '');
    
  } while (prev !== current);
  
  return current;
}

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';
mongoose.connect(MONGODB_URI)
.then(async () => {
  console.log('✅ MongoDB connected successfully');
  
  // Initialize Redis services after MongoDB is connected
  console.log('🔄 Initializing Redis services...');
  await Promise.all([
    cacheService.init().catch(err => console.warn('⚠️ Cache service:', err.message)),
    concurrencyService.init().catch(err => console.warn('⚠️ Concurrency service:', err.message))
  ]);
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

// Health check
app.get('/api/health', async (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Backend server is running',
    services: {
      mongodb: mongoose.connection.readyState === 1,
      redis: cacheService.isConnected(),
      locks: concurrencyService.isConnected()
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

