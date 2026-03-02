const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');
const cacheService = require('../services/cacheService');
const messageQueueService = require('../services/messageQueueService');
const concurrencyService = require('../services/concurrencyService');
const axios = require('axios');

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
  const { eventId, quantity, categoryName } = req.body;
  const qty = parseInt(quantity, 10);

  console.log(`Purchase request - quantity from body: ${quantity}, parsed qty: ${qty}, type: ${typeof qty}`);

  // Validate quantity
  if (!eventId || !qty || qty < 1 || qty > 15 || isNaN(qty)) {
    return res.status(400).json({ 
      message: 'Invalid quantity. Must be between 1 and 15 tickets.' 
    });
  }

  const lockKey = `ticket-purchase:${eventId}`;
  let lockToken = null;

  try {
    // Acquire distributed lock for this event
    lockToken = await concurrencyService.acquireLock(lockKey, 30);
    
    if (!lockToken) {
      return res.status(429).json({ 
        message: 'Too many concurrent requests. Please try again.' 
      });
    }

    // Start database transaction simulation (optimistic locking)
    const result = await concurrencyService.optimisticUpdate(
      Event,
      eventId,
      async (event) => {
        // Validate event exists and is available
        if (!event) {
          throw new Error('Event not found');
        }

        if (event.availableTickets < qty) {
          throw new Error(`Only ${event.availableTickets} tickets available`);
        }

        // If category-specific, validate category availability
        if (categoryName && event.ticketCategories) {
          const category = event.ticketCategories.find(cat => cat.name === categoryName);
          if (category && category.availableSeats < qty) {
            throw new Error(`Only ${category.availableSeats} ${categoryName} tickets available`);
          }
        }

        // Calculate dynamic price using ML model
        let predictedPrice = event.ticketPrice;
        
        try {
          const mlResponse = await axios.post('http://localhost:5000/predict', {
            features: {
              available_tickets: event.availableTickets - qty,
              total_capacity: event.totalCapacity,
              days_until_event: Math.ceil((new Date(event.date) - new Date()) / (1000 * 60 * 60 * 24)),
              event_popularity: event.popularity || 5,
              historical_demand: event.historicalDemand || 0.5
            }
          });

          if (mlResponse.data.predicted_price) {
            predictedPrice = mlResponse.data.predicted_price;
          }
        } catch (mlError) {
          console.error('ML prediction error:', mlError.message);
          // Continue with base price if ML fails
        }

        // Create ticket record
        const ticket = new Ticket({
          eventId: event._id,
          userId: req.user.id,
          quantity: qty,
          price: predictedPrice,
          totalAmount: predictedPrice * qty,
          purchaseDate: new Date(),
          status: 'confirmed',
          categoryName: categoryName || 'standard'
        });

        await ticket.save();
        console.log(`Ticket created - quantity: ${ticket.quantity}, id: ${ticket._id}`);

        // Update event inventory
        const updateObj = {
          $set: {
            availableTickets: event.availableTickets - qty
          }
        };

        // Update category-specific inventory if applicable
        if (categoryName && event.ticketCategories) {
          const categoryIndex = event.ticketCategories.findIndex(cat => cat.name === categoryName);
          if (categoryIndex !== -1) {
            updateObj.$set[`ticketCategories.${categoryIndex}.availableSeats`] = 
              event.ticketCategories[categoryIndex].availableSeats - qty;
          }
        }

        // Update ticketsSold if available (for non-category events)
        if (event.ticketsSold !== undefined) {
          updateObj.$set.ticketsSold = (event.ticketsSold || 0) + qty;
        }

        // Publish async events
        await messageQueueService.publishTicketPurchase({
          ticketId: ticket._id,
          eventId: event._id,
          userId: req.user.id,
          quantity: qty,
          totalAmount: ticket.totalAmount
        });

        await messageQueueService.publishAnalytics({
          type: 'TICKET_SALE',
          eventId: event._id,
          quantity: qty,
          revenue: ticket.totalAmount,
          timestamp: new Date()
        });

        // Invalidate caches
        await cacheService.invalidatePattern(`tickets:user:${req.user.id}`);
        await cacheService.invalidatePattern(`event:${eventId}`);
        await cacheService.invalidatePattern('events:*');

        return {
          ticket,
          updates: updateObj
        };
      }
    );

    // Release lock
    await concurrencyService.releaseLock(lockKey, lockToken);

    console.log(`Purchase successful - ticket qty: ${result.ticket.quantity}, updated event available: ${result.updatedDocument?.availableTickets}`);

    // Return updated event data with the response
    res.status(201).json({
      message: 'Ticket purchased successfully',
      ticket: result.ticket,
      event: result.updatedDocument
    });
  } catch (error) {
    // Release lock on error
    if (lockToken) {
      await concurrencyService.releaseLock(lockKey, lockToken);
    }

    console.error('Error purchasing ticket:', error);
    
    if (error.message.includes('available')) {
      return res.status(400).json({ message: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message.includes('lock failed')) {
      return res.status(409).json({ 
        message: 'Unable to process request due to concurrent updates. Please try again.' 
      });
    }

    res.status(500).json({ message: 'Error processing ticket purchase' });
  }
});

// Batch purchase tickets with rate limiting
router.post('/batch', protect, async (req, res) => {
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
    // Process purchases with concurrency limit
    const results = await concurrencyService.batchProcess(
      purchases,
      async (purchase) => {
        try {
          const response = await axios.post(
            'http://localhost:3001/api/tickets',
            purchase,
            {
              headers: {
                Authorization: req.header('Authorization')
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
      },
      3 // Max 3 concurrent purchases
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
        // Get event to update category-specific inventory
        const event = await Event.findById(ticket.eventId);
        
        const updateObj = {
          $inc: { availableTickets: ticket.quantity }
        };

        // Restore category-specific seats if applicable
        if (ticket.categoryName && event && event.ticketCategories) {
          const categoryIndex = event.ticketCategories.findIndex(cat => cat.name === ticket.categoryName);
          if (categoryIndex !== -1) {
            updateObj.$inc[`ticketCategories.${categoryIndex}.availableSeats`] = ticket.quantity;
          }
        }

        // Decrement ticketsSold if it exists
        if (event && event.ticketsSold !== undefined) {
          updateObj.$inc.ticketsSold = -ticket.quantity;
        }

        // Update event inventory
        await Event.findByIdAndUpdate(ticket.eventId, updateObj);

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
        await cacheService.invalidatePattern(`tickets:user:${req.user.id}`);
        await cacheService.invalidatePattern(`event:${ticket.eventId}`);
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
