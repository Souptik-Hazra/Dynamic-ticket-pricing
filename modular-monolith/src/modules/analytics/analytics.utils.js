import Event from '../../shared/models/Event.js';
import Ticket from '../../shared/models/Ticket.js';
import { cacheSet, cacheGet } from '../../shared/cache.js';

export const getDashboardStats = async (userId, role, bypassCache = false) => {
  const cacheKey = `analytics:dashboard:${userId}`;
  if (!bypassCache) {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [summary, salesTrends, categoryDistribution, topVenues] = await Promise.all([
    Event.aggregate([
      { $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalCapacity: { $sum: '$capacity' },
        totalRevenue: { $sum: '$totalRevenue' },
        avgOccupancy: { $avg: { $cond: [{ $gt: ['$capacity', 0] }, { $divide: ['$ticketsSold', '$capacity'] }, 0] } }
      }}
    ]),
    Ticket.aggregate([
      { $match: { purchaseDate: { $gte: thirtyDaysAgo }, status: 'confirmed' } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" } },
        revenue: { $sum: "$totalAmount" },
        count: { $sum: "$quantity" }
      }},
      { $sort: { "_id": 1 } }
    ]),
    Event.aggregate([
      { $group: {
        _id: "$category",
        count: { $sum: 1 },
        revenue: { $sum: "$totalRevenue" }
      }},
      { $sort: { revenue: -1 } }
    ]),
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
    categories: categoryDistribution.map(c => ({ name: c._id || 'Uncategorized', revenue: c.revenue, count: c.count })),
    venues: topVenues.map(v => ({ name: v._id || 'Unknown', revenue: v.totalRevenue, count: v.eventCount })),
    lastUpdated: new Date().toISOString()
  };

  await cacheSet(cacheKey, result, 300);
  return result;
};
