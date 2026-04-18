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

// Dummy models for analytics (replace with real models/aggregation in production)
const eventSchema = new mongoose.Schema({ ticketsSold: Number, revenue: Number });
const ticketSchema = new mongoose.Schema({});
const Event = mongoose.model('Event', eventSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);

// Health endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Analytics endpoint
app.get('/api/analytics', authenticateJWT, async (req, res) => {
  // Replace with real aggregation logic
  const totalEvents = await Event.countDocuments();
  const totalTicketsSold = await Event.aggregate([{ $group: { _id: null, total: { $sum: '$ticketsSold' } } }]);
  const totalRevenue = await Event.aggregate([{ $group: { _id: null, total: { $sum: '$revenue' } } }]);
  res.json({
    totalEvents,
    totalTicketsSold: totalTicketsSold[0]?.total || 0,
    totalRevenue: totalRevenue[0]?.total || 0
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 4011;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/analytics';
mongoose.connect(MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`Analytics service running on port ${PORT}`));
});
