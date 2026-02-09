const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { protect, admin } = require('../middleware/auth');

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

module.exports = router;
