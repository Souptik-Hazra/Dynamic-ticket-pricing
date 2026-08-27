const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, admin } = require('../middleware/auth');

// @route   GET /api/admin/events
// @desc    Get all events with calculated profit metrics
// @access  Private/Admin
router.get('/events', protect, admin, async (req, res) => {
  try {
    await Event.updateEventStatuses();
    const events = await Event.find().sort({ createdAt: -1 });

    const eventsWithProfit = await Promise.all(events.map(async (event) => {
      const eventObj = event.toObject();
      const tickets = await Ticket.find({ eventId: event._id, status: 'confirmed' });
      
      const actualRevenue = tickets.reduce((sum, t) => sum + t.totalAmount, 0);
      let baseRevenue = 0;
      tickets.forEach(ticket => {
        const category = event.ticketCategories?.find(c => c.name === ticket.categoryName);
        if (category) {
          baseRevenue += category.price * ticket.quantity;
        }
      });

      const profitAmount = actualRevenue - baseRevenue;
      const profitPercentage = baseRevenue > 0 ? ((profitAmount / baseRevenue) * 100) : 0;

      return {
        ...eventObj,
        totalRevenue: actualRevenue,
        baseRevenue,
        profitAmount,
        profitPercentage
      };
    }));

    res.json({ success: true, count: eventsWithProfit.length, events: eventsWithProfit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/admin/events
// @desc    Create new event
// @access  Private/Admin
router.post('/events', protect, admin, async (req, res) => {
  try {
    if (!req.body.startDate || !req.body.ticketCategories?.length) {
      return res.status(400).json({ error: 'Start date and ticket categories are required' });
    }

    const event = await Event.create(req.body);
    res.status(201).json({ success: true, message: 'Event created successfully', event });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/admin/events/:id
// @desc    Update existing event
// @access  Private/Admin
router.put('/events/:id', protect, admin, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true, message: 'Event updated successfully', event });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/admin/events/:id
// @desc    Delete event
// @access  Private/Admin
router.delete('/events/:id', protect, admin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics overview
// @access  Private/Admin
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const [totalEvents, totalUsers, totalTickets, recentTickets] = await Promise.all([
      Event.countDocuments(),
      User.countDocuments(),
      Ticket.countDocuments({ status: 'confirmed' }),
      Ticket.find()
        .sort({ purchaseDate: -1 })
        .limit(10)
        .populate('eventId', 'name venue')
        .populate('userId', 'name email')
    ]);

    const revResult = await Ticket.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalEvents,
        totalUsers,
        totalTickets,
        totalRevenue: revResult[0]?.total || 0,
        recentTickets: recentTickets.map(t => ({
          _id: t._id,
          customerName: t.customerName || t.userId?.name || 'Customer',
          event: t.eventId ? { name: t.eventId.name, venue: t.eventId.venue } : null,
          quantity: t.quantity,
          totalAmount: t.totalAmount,
          purchaseDate: t.purchaseDate,
          categoryName: t.categoryName
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/admin/tickets
// @desc    Get all tickets with buyer information
// @access  Private/Admin
router.get('/tickets', protect, admin, async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .sort({ purchaseDate: -1 })
      .populate('eventId', 'name venue category')
      .populate('userId', 'name email');

    res.json({
      success: true,
      count: tickets.length,
      tickets: tickets.map(t => ({
        _id: t._id,
        bookingReference: t.bookingReference,
        eventName: t.eventId?.name || 'Event',
        eventVenue: t.eventId?.venue || '',
        buyerName: t.customerName || t.userId?.name || 'Customer',
        buyerEmail: t.customerEmail || t.userId?.email || 'N/A',
        categoryName: t.categoryName || 'standard',
        quantity: t.quantity,
        pricePerTicket: t.price,
        totalAmount: t.totalAmount,
        status: t.status,
        purchaseDate: t.purchaseDate
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/admin/fraud-analytics
// @desc    Get risk assessment and fraud analytics
// @access  Private/Admin
router.get('/fraud-analytics', protect, admin, async (req, res) => {
  try {
    const tickets = await Ticket.find({ status: 'confirmed' }).populate('userId', 'name email');
    const userMap = {};

    tickets.forEach(t => {
      const uid = t.userId?._id?.toString() || 'guest';
      if (!userMap[uid]) {
        userMap[uid] = {
          userId: uid,
          userName: t.customerName || t.userId?.name || 'Guest User',
          userEmail: t.customerEmail || t.userId?.email || 'N/A',
          totalPurchases: 0,
          totalTickets: 0,
          totalSpent: 0,
          fraudScore: t.fraudScore || 0,
          riskLevel: (t.fraudScore || 0) >= 60 ? 'high' : (t.fraudScore || 0) >= 30 ? 'medium' : 'low',
          flaggedReasons: t.fraudReasons || []
        };
      }
      userMap[uid].totalPurchases += 1;
      userMap[uid].totalTickets += t.quantity;
      userMap[uid].totalSpent += t.totalAmount;
    });

    const userRankings = Object.values(userMap).sort((a, b) => b.fraudScore - a.fraudScore);
    const highRiskUsers = userRankings.filter(u => u.riskLevel === 'high').length;
    const mediumRiskUsers = userRankings.filter(u => u.riskLevel === 'medium').length;

    res.json({
      success: true,
      fraudAnalytics: {
        summary: {
          totalUsers: userRankings.length,
          highRiskUsers,
          mediumRiskUsers,
          lowRiskUsers: Math.max(0, userRankings.length - highRiskUsers - mediumRiskUsers),
          avgFraudScore: userRankings.length ? (userRankings.reduce((sum, u) => sum + u.fraudScore, 0) / userRankings.length).toFixed(1) : 0
        },
        userRankings: userRankings.slice(0, 30)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/admin/notify
// @desc    Broadcast notification to users
// @access  Private/Admin
router.post('/notify', protect, admin, async (req, res) => {
  try {
    const { message, eventId } = req.body;
    if (!message) return res.status(400).json({ error: 'Notification message is required' });

    let targetUsers = [];
    if (eventId) {
      const tickets = await Ticket.find({ eventId }, 'userId');
      const uids = [...new Set(tickets.map(t => t.userId.toString()))];
      targetUsers = await User.find({ _id: { $in: uids } }, '_id');
    } else {
      targetUsers = await User.find({ role: 'user' }, '_id');
    }

    const notifications = targetUsers.map(u => ({ userId: u._id, message }));
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.json({ success: true, count: notifications.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
