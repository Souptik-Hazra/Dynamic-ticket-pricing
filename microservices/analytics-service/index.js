import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
import { cacheGet, cacheSet } from '../shared/interservice.js';

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
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    // Serve from cache for 2 minutes to avoid hammering DB
    const cached = await cacheGet('analytics:summary');
    if (cached) return res.json(cached);

    const now = new Date();
    const [totalEvents, upcomingEvents, statsAgg] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ startDate: { $gt: now }, status: { $ne: 'cancelled' } }),
      Event.aggregate([
        { $group: { 
          _id: null, 
          totalTicketsSold: { $sum: '$ticketsSold' }, 
          totalRevenue: { $sum: '$totalRevenue' } 
        } }
      ]),
    ]);

    const result = {
      totalEvents,
      upcomingEvents,
      totalTicketsSold: statsAgg[0]?.totalTicketsSold || 0,
      totalRevenue:     statsAgg[0]?.totalRevenue    || 0,
    };

    cacheSet('analytics:summary', result, 120); // cache for 2 minutes
    res.json(result);
  } catch (err) { next(err); }
});

app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT_ANALYTICS_SERVICE || process.env.PORT || 4011;
const server = app.listen(PORT, () => console.log(`Analytics Service running on port ${PORT}`));
registerProcessHandlers(server, 'AnalyticsService');
