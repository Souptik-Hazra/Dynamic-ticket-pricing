import SystemLog from '../../../shared/models/systemLog.model.js';

export const findLogs = async (limit = 100) => {
  return await SystemLog.find().sort({ timestamp: -1 }).limit(limit);
};

export const aggregateLogs = async (pipeline) => {
  return await SystemLog.aggregate(pipeline);
};

// We use these models for aggregation across modules
import Event from '../../catalog/model/event.model.js';
import Ticket from '../../tickets/model/ticket.model.js';

export const getDashboardSummary = async () => {
  return await Event.aggregate([
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        totalCapacity: { $sum: '$capacity' },
        totalRevenue: { $sum: '$totalRevenue' },
        avgOccupancy: { $avg: { $cond: [{ $gt: ['$capacity', 0] }, { $divide: ['$ticketsSold', '$capacity'] }, 0] } }
      }
    }
  ]);
};

export const getSalesTrends = async (since) => {
  return await Ticket.aggregate([
    { $match: { purchaseDate: { $gte: since }, status: 'confirmed' } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" } },
        revenue: { $sum: "$totalAmount" },
        count: { $sum: "$quantity" }
      }
    },
    { $sort: { "_id": 1 } }
  ]);
};

export const getCategoryDistribution = async () => {
  return await Event.aggregate([
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        revenue: { $sum: "$totalRevenue" }
      }
    },
    { $sort: { revenue: -1 } }
  ]);
};

export const getTopVenues = async () => {
  return await Event.aggregate([
    {
      $group: {
        _id: "$venue",
        totalRevenue: { $sum: "$totalRevenue" },
        eventCount: { $sum: 1 }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 5 }
  ]);
};

export default {
  findLogs,
  aggregateLogs,
  getDashboardSummary,
  getSalesTrends,
  getCategoryDistribution,
  getTopVenues
};
