import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import connectDB, { requireDB, registerProcessHandlers, tuneExpressServer } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Event from '../shared/models/Event.js';
import Ticket from '../shared/models/Ticket.js';
import { cacheGet, cacheSet } from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json());

connectDB('AnalyticsService');

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'analytics-service', ts: new Date().toISOString() })
);

app.get('/api/analytics/dashboard', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'organizer')
      return res.status(403).json({ error: 'Analytics access restricted' });

    // Use cache only for heavy summary, let trends be more real-time
    const cacheKey = `analytics:dashboard:${req.user.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [summary, salesTrends, categoryDistribution, topVenues] = await Promise.all([
      // 1. Basic Summary Stats
      Event.aggregate([
        { $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          totalRevenue: { $sum: '$totalRevenue' },
          avgOccupancy: { $avg: { $cond: [{ $gt: ['$capacity', 0] }, { $divide: ['$ticketsSold', '$capacity'] }, 0] } }
        }}
      ]),

      // 2. Sales Trends (Last 30 Days)
      Ticket.aggregate([
        { $match: { purchaseDate: { $gte: thirtyDaysAgo }, status: 'confirmed' } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" } },
          revenue: { $sum: "$totalAmount" },
          count: { $sum: "$quantity" }
        }},
        { $sort: { "_id": 1 } }
      ]),

      // 3. Category Distribution
      Event.aggregate([
        { $group: {
          _id: "$category",
          count: { $sum: 1 },
          revenue: { $sum: "$totalRevenue" }
        }},
        { $sort: { revenue: -1 } }
      ]),

      // 4. Top Venues by Revenue
      Event.aggregate([
        { $group: {
          _id: "$venue",
          totalRevenue: { $sum: "$totalRevenue" },
          eventCount: { $sum: 1 }
        }},
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ])
    ]);

    const result = {
      summary: summary[0] || { totalEvents: 0, totalCapacity: 0, totalRevenue: 0, avgOccupancy: 0 },
      trends: salesTrends.map(t => ({ date: t._id, revenue: t.revenue, count: t.count })),
      categories: categoryDistribution.map(c => ({ name: c._id, revenue: c.revenue, count: c.count })),
      venues: topVenues.map(v => ({ name: v._id, revenue: v.totalRevenue, count: v.eventCount })),
      lastUpdated: new Date().toISOString()
    };

    // Cache for 5 minutes
    await cacheSet(cacheKey, result, 300);
    res.json(result);
  } catch (err) { next(err); }
});

app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT_ANALYTICS_SERVICE || 4011;
const server = app.listen(PORT, () => console.log(`Analytics Service running on port ${PORT}`));
registerProcessHandlers(server, 'AnalyticsService');
tuneExpressServer(server);
