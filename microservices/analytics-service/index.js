import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB('AnalyticsService');

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'analytics-service', ts: new Date().toISOString() })
);

app.get('/api/analytics', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const now = new Date();
    const [totalEvents, upcomingEvents, ticketAgg, revenueAgg] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ startDate: { $gt: now }, status: { $ne: 'cancelled' } }),
      Ticket.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, totalTicketsSold: { $sum: '$quantity' } } }]),
      Ticket.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }]),
    ]);
    res.json({
      totalEvents,
      upcomingEvents,
      totalTicketsSold: ticketAgg[0]?.totalTicketsSold || 0,
      totalRevenue:     revenueAgg[0]?.totalRevenue    || 0,
    });
  } catch (err) { next(err); }
});

app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT || 4011;
const server = app.listen(PORT, () => console.log(`Analytics Service running on port ${PORT}`));
registerProcessHandlers(server, 'AnalyticsService');
