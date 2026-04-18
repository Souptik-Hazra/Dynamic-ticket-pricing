const PORT = process.env.PORT || 4012;
app.listen(PORT, () => {
  console.log(`Subscription Service running on port ${PORT}`);
});
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// JWT Middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
}

// Subscription Schema
const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  plan: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
});
const Subscription = mongoose.model('Subscription', subscriptionSchema);

// Health endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Upgrade subscription
app.post('/api/subscription/upgrade', authenticateJWT, async (req, res) => {
  const { plan } = req.body;
  const userId = req.user.id;
  if (!plan) return res.status(400).json({ error: 'Plan required' });
  // Plan durations (days)
  const planDurations = {
    '7_days': 7,
    '30_days': 30,
    '3_months': 90,
    '6_months': 180,
    '1_year': 365
  };
  const duration = planDurations[plan];
  if (!duration) return res.status(400).json({ error: 'Invalid plan' });
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
  const subscription = await Subscription.findOneAndUpdate(
    { userId },
    { plan, startDate, endDate, isActive: true },
    { upsert: true, new: true }
  );
  res.json({ success: true, subscription });
});

// Get current subscription
app.get('/api/subscription', authenticateJWT, async (req, res) => {
  const userId = req.user.id;
  const subscription = await Subscription.findOne({ userId });
  if (!subscription) return res.json({ plan: 'none', isActive: false });
  res.json(subscription);
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 4007;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/subscription';
mongoose.connect(MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`Subscription service running on port ${PORT}`));
});
