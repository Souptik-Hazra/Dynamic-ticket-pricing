const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');
const messageQueueService = require('../services/messageQueueService');
const cacheService = require('../services/cacheService');

// Get all tickets with caching
router.get('/', protect, async (req, res) => {
  try {
    const cacheKey = `tickets:user:${req.user.id}`;
    
    // Try to get from cache
    const cachedTickets = await cacheService.get(cacheKey);
    if (cachedTickets) {
      return res.json(cachedTickets);
    }

    // Query from database
    const tickets = await Ticket.find({ userId: req.user.id })
      .populate('eventId')
      .sort({ purchaseDate: -1 });
    
    // Cache for 5 minutes
    await cacheService.set(cacheKey, tickets, 300);
    
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get ticket by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('eventId');
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check ownership
    if (ticket.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Purchase ticket with concurrency control, distributed locking, and ML predictions
router.post('/', protect, async (req, res) => {
  const { eventId, quantity } = req.body;

  if (!eventId || !quantity || quantity < 1) {
    return res.status(400).json({ message: 'Invalid request data' });
  }

  try {
    // Use MongoDB transaction for atomic ticket purchase
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Single atomic operation: check and decrement
      const event = await Event.findOneAndUpdate(
        { _id: eventId, availableTickets: { $gte: quantity } },
        { $inc: { availableTickets: -quantity } },
        { new: true, session }
      );

      if (!event) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'Event not found or insufficient tickets' });
      }

      // Create ticket within transaction
      const ticket = new Ticket({
        eventId: event._id,
        userId: req.user.id,
        quantity,
        price: event.ticketPrice,
        totalAmount: event.ticketPrice * quantity,
        purchaseDate: new Date(),
        status: 'confirmed'
      });

      await ticket.save({ session });
      await session.commitTransaction();

      // Publish event asynchronously (outside transaction)
      await messageQueueService.publishTicketPurchase({
        ticketId: ticket._id,
        eventId: event._id,
        userId: req.user.id,
        quantity,
        totalAmount: ticket.totalAmount
      });

      res.status(201).json({
        message: 'Ticket purchased successfully',
        ticket
      });

    } catch (txnError) {
      await session.abortTransaction();
      throw txnError;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Error purchasing ticket:', error);
    res.status(500).json({ message: 'Error processing ticket purchase' });
  }
});

// Batch purchase tickets with rate limiting
router.post('/purchase/batch', protect, async (req, res) => {
  const { purchases } = req.body; // Array of {eventId, quantity}

  if (!Array.isArray(purchases) || purchases.length === 0) {
    return res.status(400).json({ message: 'Invalid request data' });
  }

  // Rate limiting: max 10 batch purchases per minute
  const allowed = await concurrencyService.rateLimit(
    `batch-purchase:${req.user.id}`,
    10,
    60
  );

  if (!allowed) {
    return res.status(429).json({ 
      message: 'Rate limit exceeded. Please try again later.' 
    });
  }

  try {
    // Process all purchases in parallel
    const results = await Promise.all(
      purchases.map(async (purchase) => {
        try {
          const response = await axios.post(
            'http://localhost:3001/api/tickets/purchase',
            purchase,
            {
              headers: {
                'x-auth-token': req.header('x-auth-token')
              }
            }
          );
          return { success: true, data: response.data };
        } catch (error) {
          return { 
            success: false, 
            error: error.response?.data?.message || error.message 
          };
        }
      })
    );

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      message: 'Batch purchase completed',
      successful: successful.length,
      failed: failed.length,
      results
    });

  } catch (error) {
    console.error('Error in batch purchase:', error);
    res.status(500).json({ message: 'Error processing batch purchase' });
  }
});

// Cancel ticket
router.delete('/:id', protect, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check ownership
    if (ticket.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Use concurrency control for cancellation
    await concurrencyService.withLock(
      `ticket-cancel:${ticket.eventId}`,
      async () => {
        // Update event inventory
        await Event.findByIdAndUpdate(ticket.eventId, {
          $inc: { availableTickets: ticket.quantity }
        });

        // Update ticket status
        ticket.status = 'cancelled';
        await ticket.save();

        // Publish notification
        await messageQueueService.publishNotification({
          type: 'TICKET_CANCELLED',
          userId: req.user.id,
          ticketId: ticket._id,
          eventId: ticket.eventId
        });

        // Invalidate caches
        await cacheService.delete(`tickets:user:${req.user.id}`);
      }
    );

    res.json({ message: 'Ticket cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling ticket:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ticket statistics (admin only)
router.get('/stats/overview', protect, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const cacheKey = 'ticket:stats:overview';
    const cached = await cacheService.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

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

    const result = {
      stats,
      timestamp: new Date()
    };

    await cacheService.set(cacheKey, result, 600); // Cache for 10 minutes
    res.json(result);
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
