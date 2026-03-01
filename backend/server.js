const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import models
const Event = require('./models/Event');
const Ticket = require('./models/Ticket');
const { PricePrediction } = require('./models/MLModel');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const subscriptionRoutes = require('./routes/subscription');
const ticketRoutes = require('./routes/tickets');
const analyticsRoutes = require('./routes/analytics');
const eventRoutes = require('./routes/events');
const mlModelRoutes = require('./routes/mlModel');

const app = express();

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'souptik_session_secret',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Ticket routes
app.use('/api/tickets', ticketRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

// ML Model routes
app.use('/api/ml', mlModelRoutes);

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

