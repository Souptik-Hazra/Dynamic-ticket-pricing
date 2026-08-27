// Dynamic Ticket Pricing System v2.0
const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');
const cacheService = require('../services/cacheService');

// @route   GET /api/tickets
// @desc    Get all tickets for the logged-in user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const cacheKey = `tickets:user:${req.user.id}`;
    const cachedTickets = await cacheService.get(cacheKey);
    if (cachedTickets) {
      return res.json(cachedTickets);
    }

    const tickets = await Ticket.find({ userId: req.user.id })
      .populate('eventId')
      .sort({ purchaseDate: -1 });

    await cacheService.set(cacheKey, tickets, 300);
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Server error fetching tickets' });
  }
});

// @route   GET /api/tickets/stats/overview
// @desc    Get ticket sales stats (Admin only)
// @access  Private/Admin
router.get('/stats/overview', protect, async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const stats = await Ticket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);
    res.json({ success: true, stats, timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/tickets/:id
// @desc    Get ticket details by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('eventId');
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Shared Purchase Handler (supports POST / and POST /purchase)
const handleTicketPurchase = async (req, res) => {
  try {
    const { eventId, categoryName, quantity, pricePerTicket, customerName, customerEmail } = req.body;
    const qty = parseInt(quantity, 10);

    if (!eventId || !qty || qty < 1 || isNaN(qty)) {
      return res.status(400).json({ error: 'Invalid purchase request. Quantity must be >= 1.' });
    }

    if (qty > 15) {
      return res.status(400).json({ error: 'Maximum 15 tickets allowed per purchase.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let price = pricePerTicket || event.currentPrice || event.basePrice;
    let categoryObj = null;

    if (categoryName && event.ticketCategories) {
      categoryObj = event.ticketCategories.find(c => c.name === categoryName);
      if (categoryObj) {
        if (categoryObj.availableSeats < qty) {
          return res.status(400).json({ error: `Only ${categoryObj.availableSeats} ${categoryName} tickets available.` });
        }
        price = categoryObj.price;
        categoryObj.availableSeats -= qty;
      }
    }

    if (event.availableTickets < qty) {
      return res.status(400).json({ error: `Only ${event.availableTickets} tickets available.` });
    }

    const totalAmount = price * qty;
    const bookingReference = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const ticket = new Ticket({
      eventId: event._id,
      userId: req.user.id,
      customerName: customerName || req.user.name,
      customerEmail: customerEmail || req.user.email,
      quantity: qty,
      price,
      totalAmount,
      categoryName: categoryName || 'standard',
      ticketType: categoryName || 'standard',
      status: 'confirmed',
      purchaseDate: new Date(),
      bookingReference
    });

    await ticket.save();

    // Update event inventory & sales metrics
    event.ticketsSold += qty;
    event.availableTickets = Math.max(0, event.availableTickets - qty);
    event.totalSales += totalAmount;
    event.totalRevenue += totalAmount;
    await event.save();

    // Invalidate caches
    await cacheService.del(`tickets:user:${req.user.id}`);
    await cacheService.del(`event:${eventId}`);
    await cacheService.del('events:all');

    res.status(201).json({
      message: 'Ticket purchased successfully',
      bookingReference,
      ticket
    });
  } catch (error) {
    console.error('Error processing ticket purchase:', error);
    res.status(500).json({ error: error.message || 'Ticket purchase failed' });
  }
};

// @route   POST /api/tickets & POST /api/tickets/purchase
// @desc    Purchase tickets for an event (Backward compatible routes)
// @access  Private
router.post('/', protect, handleTicketPurchase);
router.post('/purchase', protect, handleTicketPurchase);

// @route   DELETE /api/tickets/:id
// @desc    Cancel ticket purchase
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Event.findByIdAndUpdate(ticket.eventId, {
      $inc: { availableTickets: ticket.quantity, ticketsSold: -ticket.quantity }
    });

    ticket.status = 'cancelled';
    await ticket.save();

    await cacheService.del(`tickets:user:${req.user.id}`);
    await cacheService.del(`event:${ticket.eventId}`);
    await cacheService.del('events:all');

    res.json({ message: 'Ticket cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling ticket:', error);
    res.status(500).json({ error: 'Server error cancelling ticket' });
  }
});

module.exports = router;
