const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');

// @route   GET /api/analytics
// @desc    Get system analytics
// @access  Public (can be protected if needed)
router.get('/', async (req, res) => {
  try {
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

    res.json({
      success: true,
      message: 'Analytics retrieved successfully',
      data: {
        totalEvents,
        upcomingEvents,
        totalTicketsSold: stats.totalTickets,
        totalRevenue: stats.totalRevenue,
        topEvents: eventRevenue
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

module.exports = router;
