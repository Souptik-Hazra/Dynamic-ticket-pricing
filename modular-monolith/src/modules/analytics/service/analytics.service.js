import analyticsRepo from '../repository/analytics.repo.js';
import { cacheGet, cacheSet } from '../../../shared/utils/cache.js';

export const getPlatformDashboard = async (userId, role, forceRefresh) => {
  const cacheKey = `analytics:dashboard:${userId}`;
  if (!forceRefresh) {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [summary, salesTrends, categoryDistribution, topVenues] = await Promise.all([
    analyticsRepo.getDashboardSummary(),
    analyticsRepo.getSalesTrends(thirtyDaysAgo),
    analyticsRepo.getCategoryDistribution(),
    analyticsRepo.getTopVenues()
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

export const getSystemLogs = async (limit = 100) => {
  return await analyticsRepo.findLogs(limit);
};

export const getSystemHealthMetrics = async () => {
  const cacheKey = 'admin:system:health';
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const [serviceDistribution, errorTimeline] = await Promise.all([
    analyticsRepo.aggregateLogs([
      { $match: { timestamp: { $gte: twentyFourHoursAgo } } },
      { $group: { _id: '$service', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    analyticsRepo.aggregateLogs([
      { $match: { timestamp: { $gte: twentyFourHoursAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  const result = {
    serviceDistribution: serviceDistribution.map(s => ({ name: s._id, value: s.count })),
    errorTimeline: errorTimeline.map(t => ({ 
      time: t._id.replace(' ', 'T') + ':00Z', 
      errors: t.count 
    }))
  };

  await cacheSet(cacheKey, result, 300);
  return result;
};

export default { 
  getPlatformDashboard, 
  getSystemLogs, 
  getSystemHealthMetrics 
};
