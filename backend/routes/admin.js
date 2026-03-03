
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');
const { protect, admin } = require('../middleware/auth');
// Get user groups for notification targeting
router.get('/user-groups', protect, admin, async (req, res) => {
  try {
    const User = require('../models/User');
    // Example: group by city and subscription plan
    const cities = await User.distinct('city', { city: { $ne: '' }, role: 'user' });
    const plans = await User.distinct('subscription.plan', { 'subscription.plan': { $nin: [null, '', 'none'] }, role: 'user' });
    const groups = [
      ...cities.map(city => ({ id: city, name: `City: ${city}` })),
      ...plans.map(plan => ({ id: plan, name: `Plan: ${plan}` }))
    ];
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user groups' });
  }
});

// @route   GET /api/admin/events
// @desc    Get all events (admin view with full details)
// @access  Private/Admin
router.get('/events', protect, admin, async (req, res) => {
  try {
    // Auto-update event statuses based on current date
    await Event.updateEventStatuses();
    
    const events = await Event.find().sort({ createdAt: -1 });
    
    // Calculate profit margin for each event
    const eventsWithProfit = await Promise.all(events.map(async (event) => {
      const eventObj = event.toObject();
      
      // Get all tickets for this event
      const tickets = await Ticket.find({ eventId: event._id, status: 'confirmed' });
      
      // Calculate actual revenue (from dynamic prices)
      const actualRevenue = tickets.reduce((sum, t) => sum + t.totalAmount, 0);
      
      // Calculate base revenue (what would have been if sold at base price)
      let baseRevenue = 0;
      tickets.forEach(ticket => {
        const category = event.ticketCategories.find(c => c.name === ticket.categoryName);
        if (category) {
          baseRevenue += category.price * ticket.quantity;
        }
      });
      
      // Calculate profit margin
      const profitAmount = actualRevenue - baseRevenue;
      const profitPercentage = baseRevenue > 0 ? ((profitAmount / baseRevenue) * 100) : 0;
      
      return {
        ...eventObj,
        totalRevenue: actualRevenue,
        baseRevenue: baseRevenue,
        profitAmount: profitAmount,
        profitPercentage: profitPercentage
      };
    }));
    
    res.json({
      success: true,
      count: eventsWithProfit.length,
      events: eventsWithProfit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/admin/events
// @desc    Create new event (admin only)
// @access  Private/Admin
router.post('/events', protect, admin, async (req, res) => {
  try {
    console.log('📝 Creating event with data:', req.body);
    
    // Validate required fields
    if (!req.body.ticketCategories || req.body.ticketCategories.length === 0) {
      return res.status(400).json({ error: 'At least one ticket category is required' });
    }
    
    // Validate event date is in the future
    if (!req.body.startDate) {
      return res.status(400).json({ error: 'Event start date is required' });
    }
    
    const eventDate = new Date(req.body.startDate);
    if (eventDate <= new Date()) {
      return res.status(400).json({ error: 'Event date must be in the future' });
    }
    
    // Validate new fields
    if (req.body.hourOfDay !== undefined) {
      const hour = parseInt(req.body.hourOfDay);
      if (hour < 0 || hour > 23) {
        return res.status(400).json({ error: 'Hour of day must be between 0 and 23' });
      }
    }
    
    if (req.body.venueTier !== undefined) {
      const tier = parseInt(req.body.venueTier);
      if (![1, 2, 3].includes(tier)) {
        return res.status(400).json({ error: 'Venue tier must be 1 (Small), 2 (Medium), or 3 (Large/Stadium)' });
      }
    }
    
    if (req.body.artistTier !== undefined) {
      const tier = parseInt(req.body.artistTier);
      if (tier < 1 || tier > 5) {
        return res.status(400).json({ error: 'Artist tier must be between 1 (Local) and 5 (International Superstar)' });
      }
    }
    
    // Create the event
    const event = await Event.create(req.body);
    
    console.log('✅ Event created successfully:', event._id);
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event
    });
  } catch (error) {
    console.error('❌ Event creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/admin/events/:id
// @desc    Update event (admin only)
// @access  Private/Admin
router.put('/events/:id', protect, admin, async (req, res) => {
  try {
    console.log('📝 Updating event with data:', req.body);
    
    // Validate ticket categories if provided
    if (req.body.ticketCategories && req.body.ticketCategories.length === 0) {
      return res.status(400).json({ error: 'At least one ticket category is required' });
    }
    
    // Validate new fields
    if (req.body.hourOfDay !== undefined) {
      const hour = parseInt(req.body.hourOfDay);
      if (hour < 0 || hour > 23) {
        return res.status(400).json({ error: 'Hour of day must be between 0 and 23' });
      }
    }
    
    if (req.body.venueTier !== undefined) {
      const tier = parseInt(req.body.venueTier);
      if (![1, 2, 3].includes(tier)) {
        return res.status(400).json({ error: 'Venue tier must be 1 (Small), 2 (Medium), or 3 (Large/Stadium)' });
      }
    }
    
    if (req.body.artistTier !== undefined) {
      const tier = parseInt(req.body.artistTier);
      if (tier < 1 || tier > 5) {
        return res.status(400).json({ error: 'Artist tier must be between 1 (Local) and 5 (International Superstar)' });
      }
    }
    
    // Get existing event to preserve sold ticket data
    const existingEvent = await Event.findById(req.params.id);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // If updating ticket categories, preserve availableSeats for existing categories
    if (req.body.ticketCategories) {
      req.body.ticketCategories = req.body.ticketCategories.map(newCat => {
        const existingCat = existingEvent.ticketCategories.find(c => c.name === newCat.name);
        if (existingCat) {
          // Preserve the sold ticket count
          const soldTickets = existingCat.seats - existingCat.availableSeats;
          return {
            ...newCat,
            availableSeats: Math.max(0, newCat.seats - soldTickets)
          };
        }
        // New category - availableSeats = seats
        return {
          ...newCat,
          availableSeats: newCat.availableSeats ?? newCat.seats
        };
      });
    }
    
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    console.log('✅ Event updated successfully:', event._id);

    res.json({
      success: true,
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('❌ Event update error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/admin/events/:id
// @desc    Delete event (admin only)
// @access  Private/Admin
router.delete('/events/:id', protect, admin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const Event = require('../models/Event');
    const Ticket = require('../models/Ticket');
    const User = require('../models/User');

    const [totalEvents, totalUsers, totalTickets, recentTickets] = await Promise.all([
      Event.countDocuments(),
      User.countDocuments(),
      Ticket.countDocuments({ status: 'confirmed' }),
      Ticket.find()
        .sort({ purchaseDate: -1 })
        .limit(10)
        .populate('eventId', 'name venue eventDate')
        .populate('userId', 'name email')
    ]);

    const revenueResult = await Ticket.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Transform recentTickets to include event object
    const formattedTickets = recentTickets.map(ticket => ({
      _id: ticket._id,
      customerName: ticket.customerName || ticket.userId?.name || 'Unknown',
      event: ticket.eventId ? { name: ticket.eventId.name, venue: ticket.eventId.venue } : null,
      quantity: ticket.quantity,
      totalAmount: ticket.totalAmount,
      purchaseDate: ticket.purchaseDate,
      categoryName: ticket.categoryName
    }));

    res.json({
      success: true,
      stats: {
        totalEvents,
        totalUsers,
        totalTickets,
        totalRevenue,
        recentTickets: formattedTickets
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/admin/tickets
// @desc    Get all tickets with buyer details (admin only)
// @access  Private/Admin
router.get('/tickets', protect, admin, async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    
    const tickets = await Ticket.find()
      .sort({ purchaseDate: -1 })
      .populate('eventId', 'name venue eventDate category')
      .populate('userId', 'name email');

    res.json({
      success: true,
      count: tickets.length,
      tickets: tickets.map(ticket => ({
        _id: ticket._id,
        bookingReference: ticket.bookingReference,
        eventName: ticket.eventId?.name || 'Unknown Event',
        eventVenue: ticket.eventId?.venue || '',
        eventDate: ticket.eventId?.eventDate,
        buyerName: ticket.customerName || ticket.userId?.name || 'Unknown',
        buyerEmail: ticket.customerEmail || ticket.userId?.email || 'Unknown',
        categoryName: ticket.categoryName || 'standard',
        quantity: ticket.quantity,
        pricePerTicket: ticket.price,
        totalAmount: ticket.totalAmount,
        status: ticket.status,
        purchaseDate: ticket.purchaseDate
      }))
    });
  } catch (error) {
    console.error('Tickets fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/admin/fraud-analytics
// @desc    Get fraud analytics with user risk rankings
// @access  Private/Admin
router.get('/fraud-analytics', protect, admin, async (req, res) => {
  try {
    const Ticket = require('../models/Ticket');
    const User = require('../models/User');

    // Get all confirmed tickets
    const tickets = await Ticket.find({ status: 'confirmed' })
      .populate('userId', 'name email')
      .sort({ purchaseDate: -1 });

    // Analyze user purchase patterns
    const userFraudMap = {};

    tickets.forEach(ticket => {
      const userId = ticket.userId?._id || 'unknown';
      const userName = ticket.userId?.name || ticket.customerName || 'Unknown User';
      const userEmail = ticket.userId?.email || ticket.customerEmail || 'N/A';

      if (!userFraudMap[userId]) {
        userFraudMap[userId] = {
          userId,
          userName,
          userEmail,
          totalPurchases: 0,
          totalTickets: 0,
          totalSpent: 0,
          avgTicketsPerPurchase: 0,
          purchaseFrequency: 0,
          maxTicketsInOne: 0,
          lastPurchase: null,
          flaggedReasons: [],
          fraudScore: 0,
          riskLevel: 'low',
          purchases: []
        };
      }

      const userData = userFraudMap[userId];
      userData.totalPurchases++;
      userData.totalTickets += ticket.quantity;
      userData.totalSpent += ticket.totalAmount;
      userData.lastPurchase = ticket.purchaseDate;
      userData.maxTicketsInOne = Math.max(userData.maxTicketsInOne, ticket.quantity);
      userData.purchases.push({
        date: ticket.purchaseDate,
        quantity: ticket.quantity,
        amount: ticket.totalAmount,
        categoryName: ticket.categoryName
      });
    });

    // Calculate fraud indicators for each user
    Object.values(userFraudMap).forEach(user => {
      let fraudScore = 0;
      const flagged = [];

      // Indicator 1: Bulk purchases (15+ tickets at once)
      if (user.maxTicketsInOne >= 15) {
        fraudScore += 35;
        flagged.push(`Bulk purchase detected (${user.maxTicketsInOne} tickets)`);
      } else if (user.maxTicketsInOne >= 10) {
        fraudScore += 20;
        flagged.push(`High quantity purchase (${user.maxTicketsInOne} tickets)`);
      }

      // Indicator 2: Multiple purchases in short time (purchase frequency)
      if (user.totalPurchases > 5) {
        fraudScore += 25;
        flagged.push(`High purchase frequency (${user.totalPurchases} purchases)`);
      } else if (user.totalPurchases > 3) {
        fraudScore += 15;
        flagged.push(`Frequent purchaser (${user.totalPurchases} purchases)`);
      }

      // Indicator 3: Average tickets per purchase
      user.avgTicketsPerPurchase = user.totalTickets / user.totalPurchases;
      if (user.avgTicketsPerPurchase > 10) {
        fraudScore += 20;
        flagged.push(`High avg tickets per purchase (${user.avgTicketsPerPurchase.toFixed(1)} avg)`);
      }

      // Indicator 4: Calculate purchase velocity (purchases in last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentPurchases = user.purchases.filter(p => new Date(p.date) > sevenDaysAgo).length;
      if (recentPurchases >= 3) {
        fraudScore += 15;
        flagged.push(`Rapid purchases (${recentPurchases} in last 7 days)`);
      }

      // Indicator 5: High total spending spike
      if (user.totalSpent > 50000) {
        fraudScore += 10;
        flagged.push(`High total spending (₹${user.totalSpent.toFixed(0)})`);
      }

      // Calculate final fraud score and risk level
      user.fraudScore = Math.min(100, fraudScore);
      user.flaggedReasons = flagged;

      if (user.fraudScore >= 60) {
        user.riskLevel = 'high';
      } else if (user.fraudScore >= 35) {
        user.riskLevel = 'medium';
      } else {
        user.riskLevel = 'low';
      }
    });

    // Get statistics
    const allUsers = Object.values(userFraudMap);
    const highRiskUsers = allUsers.filter(u => u.riskLevel === 'high').length;
    const mediumRiskUsers = allUsers.filter(u => u.riskLevel === 'medium').length;
    const avgFraudScore = allUsers.reduce((sum, u) => sum + u.fraudScore, 0) / allUsers.length || 0;

    // Get timeline data (last 30 days of purchases for chart)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const timelineData = {};

    Object.values(userFraudMap).forEach(user => {
      user.purchases.forEach(purchase => {
        const purchaseDate = new Date(purchase.date);
        if (purchaseDate > thirtyDaysAgo) {
          const dateStr = purchaseDate.toISOString().split('T')[0];
          if (!timelineData[dateStr]) {
            timelineData[dateStr] = { low: 0, medium: 0, high: 0, total: 0 };
          }
          timelineData[dateStr][user.riskLevel]++;
          timelineData[dateStr].total++;
        }
      });
    });

    const timeline = Object.entries(timelineData).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      success: true,
      fraudAnalytics: {
        summary: {
          totalUsers: allUsers.length,
          highRiskUsers,
          mediumRiskUsers,
          lowRiskUsers: allUsers.length - highRiskUsers - mediumRiskUsers,
          avgFraudScore: avgFraudScore.toFixed(2),
          suspiciousActivityRate: ((highRiskUsers + mediumRiskUsers) / allUsers.length * 100).toFixed(1)
        },
        userRankings: allUsers
          .sort((a, b) => b.fraudScore - a.fraudScore)
          .slice(0, 50), // Top 50 risky users
        timeline
      }
    });
  } catch (error) {
    console.error('Fraud analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin send notification to all users
// Enhanced: Send notification to all users or users of a specific event
router.post('/notify', protect, admin, async (req, res) => {
  try {
    const { message, eventId, group, priority = 'normal', schedule } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    let users = [];
    if (eventId) {
      // Find users who bought tickets for this event
      const tickets = await require('../models/Ticket').find({ eventId }, 'userId');
      const userIds = [...new Set(tickets.map(t => t.userId.toString()))];
      users = await require('../models/User').find({ _id: { $in: userIds }, role: 'user' }, '_id');
    } else if (group) {
      // Find users by group (e.g., city, subscription, etc.)
      // Example: group could be a city name or subscription plan
      // You may want to adjust this logic based on your group definition
      users = await require('../models/User').find({ $or: [
        { city: group },
        { 'subscription.plan': group }
      ], role: 'user' }, '_id');
    } else {
      // All users (excluding admins)
      users = await require('../models/User').find({ role: 'user' }, '_id');
    }
    if (!users.length) {
      return res.status(404).json({ error: 'No users found to notify.' });
    }
    const notifications = users.map(u => ({
      userId: u._id,
      message,
      group: group || undefined,
      priority,
      scheduledFor: schedule ? new Date(schedule) : undefined
    }));
    await require('../models/Notification').insertMany(notifications);
    res.json({ success: true, count: notifications.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

module.exports = router;
