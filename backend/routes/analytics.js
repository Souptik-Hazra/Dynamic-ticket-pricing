// Dynamic Ticket Pricing System v2.0
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
      startDate: { $gte: new Date() },
      status: 'upcoming'
    });

    // Get average BERT hype index across events
    const hypeStats = await Event.aggregate([
      {
        $group: {
          _id: null,
          avgHypeIndex: { $avg: '$bertSentiment.hypeIndex' },
          viralEventsCount: {
            $sum: { $cond: [{ $eq: ['$bertSentiment.sentimentLabel', 'viral_hype'] }, 1, 0] }
          }
        }
      }
    ]);
    const hypeData = hypeStats[0] || { avgHypeIndex: 0.5, viralEventsCount: 0 };

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

    const result = {
      success: true,
      totalEvents,
      upcomingEvents,
      avgHypeIndex: Math.round(hypeData.avgHypeIndex * 100) / 100,
      viralEventsCount: hypeData.viralEventsCount,
      totalTicketsSold: stats.totalTickets,
      totalRevenue: stats.totalRevenue,
      topEvents: eventRevenue
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
