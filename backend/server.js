const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Import middleware
const { errorHandler, asyncHandler } = require('./middleware/errorHandler');

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
const Event = require('./models/Event');
const Ticket = require('./models/Ticket');
const PriceHistory = require('./models/PriceHistory');
const PredictionLog = require('./models/PredictionLog');
const EventLog = require('./models/EventLog');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscription');
const mlModelRoutes = require('./routes/mlModel');
const ticketRoutes = require('./routes/tickets');
const analyticsRoutes = require('./routes/analytics');
const eventRoutes = require('./routes/events');

const app = express();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now as it can block external images/scripts
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. Rate Limiting using express-rate-limit
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => process.env.NODE_ENV !== 'production', // Skip rate limiting in development
  keyGenerator: (req) => req.ip || req.connection.remoteAddress // Use IP as key
});

app.use(limiter);


// 3. CORS Configuration (simplified)
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim())
    : /^http:\/\/localhost/,
  credentials: true
}));

// MongoDB connection string from env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'souptik_session_secret',
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: 'sessions', // Name of the collection
    ttl: 7 * 24 * 60 * 60 // = 7 days. Default
  }),
  resave: false,
  saveUninitialized: false,
  proxy: true, // trust render proxy
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Must be lax/none for cors
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

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

// Initialize all models (creates collections and indexes if not exist)
const initializeModels = async () => {
  try {
    const models = [Event, Ticket, PriceHistory, PredictionLog, EventLog];
    for (const model of models) {
      const collectionName = model.collection.name;
      const collections = await mongoose.connection.db.listCollections().toArray();
      const exists = collections.some(col => col.name === collectionName);
      
      if (exists) {
        // Collection exists, just create indexes
        await model.collection.createIndexes();
        console.log(`✅ Collection exists: ${collectionName} (indexes created)`);
      } else {
        // Create collection and indexes
        await model.collection.createIndexes();
        console.log(`✅ Created collection: ${collectionName}`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Model initialization warning:', err.message);
  }
};

// MongoDB connection
mongoose.connect(MONGODB_URI)
.then(async () => {
  console.log('✅ MongoDB connected successfully');
  await initializeModels();
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
app.get('/api/health', asyncHandler(async (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'Backend server is running',
    services: {
      mongodb: mongoose.connection.readyState === 1
    },
    timestamp: new Date().toISOString()
  });
}));

// 404 Not Found handler (must be before error handler)
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Centralized Error Handler (must be last middleware)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
});

