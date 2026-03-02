const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const cacheService = require('../services/cacheService');

// @route   GET /api/analytics
// @desc    Get system analytics
// @access  Public (can be protected if needed)
router.get('/', async (req, res) => {
  try {
    // Try to get from cache first
    const cacheKey = 'analytics:dashboard';
    const cachedAnalytics = await cacheService.get(cacheKey);
    if (cachedAnalytics) {
      return res.json(cachedAnalytics);
    }

    // Get total events count
    const totalEvents = await Event.countDocuments();

    // Get upcoming events count
    const upcomingEvents = await Event.countDocuments({
      date: { $gte: new Date() },
      status: 'upcoming'
    });

    // Get total tickets sold
    const ticketStats = await Ticket.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const stats = ticketStats[0] || { totalTickets: 0, totalRevenue: 0 };

    // Get event revenue breakdown
    const eventRevenue = await Ticket.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id: '$eventId',
          revenue: { $sum: '$totalAmount' },
          ticketsSold: { $sum: '$quantity' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);

    // --- User Fraud Stats (Top 50) ---
    const UserFraudStats = require('../models/UserFraudStats');
    const User = require('../models/User');
    // Get top 50 users by fraudScore (descending)
    const fraudStats = await UserFraudStats.find({})
      .sort({ fraudScore: -1 })
      .limit(50)
      .lean();
    // Attach user details (name, email) to each fraud stat
    const userIds = fraudStats.map(f => f.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });
    const fraudStatsWithUser = fraudStats.map(f => {
      const user = userMap[f.userId.toString()];
      return {
        ...f,
        userName: user ? user.name : 'Unknown User',
        email: user ? user.email : 'N/A',
      };
    });


    const result = {
      success: true,
      totalEvents,
      upcomingEvents,
      totalTicketsSold: stats.totalTickets,
      totalRevenue: stats.totalRevenue,
      topEvents: eventRevenue,
      userFraudStats: fraudStatsWithUser
    };

    // Cache for 15 minutes
    await cacheService.set(cacheKey, result, 900);

    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

module.exports = router;
