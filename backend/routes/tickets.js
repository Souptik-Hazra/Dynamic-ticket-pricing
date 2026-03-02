const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');
const cacheService = require('../services/cacheService');
const messageQueueService = require('../services/messageQueueService');
const concurrencyService = require('../services/concurrencyService');
const notificationService = require('../services/notificationService');
const { fetchWithRetry } = require('../utils/retry');
const axios = require('axios');

// ML API URL from environment variable
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5000';

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

// Ticket purchase endpoint with concurrency control (POST /)
router.post('/', protect, async (req, res) => {
  const { eventId, categoryId, categoryName, quantity, pricePerTicket, customerName, customerEmail } = req.body;

  // Parse quantity as integer and validate
  const parsedQuantity = parseInt(quantity, 10);
  
  if (!eventId || !parsedQuantity || parsedQuantity < 1 || isNaN(parsedQuantity)) {
    return res.status(400).json({ error: 'Invalid request data - quantity must be a positive number' });
  }

  if (parsedQuantity > 15) {
    return res.status(400).json({ error: 'Maximum 15 tickets allowed per purchase' });
  }

  // Acquire distributed lock to prevent race conditions
  const lockKey = `ticket-purchase:${eventId}`;
  let lockAcquired = false;

  try {
    lockAcquired = await concurrencyService.acquireLock(lockKey, 30);
    
    if (!lockAcquired) {
      return res.status(429).json({ 
        error: 'Too many concurrent requests for this event. Please try again.' 
      });
    }

    console.log(`📝 Processing ticket purchase: Event=${eventId}, Category=${categoryName}, Quantity=${parsedQuantity}`);

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Calculate gradual price increase factor based on demand
    // Price starts at BASE and slowly increases to MAX
    const occupancyRate = event.capacity > 0 ? event.ticketsSold / event.capacity : 0;
    const daysUntilEvent = Math.max(1, Math.ceil((new Date(event.eventDate) - new Date()) / (1000 * 60 * 60 * 24)));
    
    // Calculate increase factor (0 to 1 range)
    // Based on: occupancy rate (40%), days until event urgency (30%), popularity (30%)
    const occupancyFactor = occupancyRate; // 0 to 1
    const urgencyFactor = daysUntilEvent <= 7 ? (7 - daysUntilEvent) / 7 : 0;
    const popularityFactor = event.eventPopularity || 0.5;
    
    const increaseFactor = (occupancyFactor * 0.4) + (urgencyFactor * 0.3) + (popularityFactor * 0.3);

    // Calculate price with gradual increase
    let price = pricePerTicket || event.currentPrice || event.basePrice;
    let availableSeats = event.availableTickets;

    if (categoryName && event.ticketCategories) {
      const category = event.ticketCategories.find(c => c.name === categoryName);
      if (category) {
        if (category.availableSeats < parsedQuantity) {
          return res.status(400).json({ error: `Only ${category.availableSeats} ${categoryName} tickets available` });
        }
        
        // Apply gradual pricing: base + (increase factor * price range)
        const basePrice = category.price;
        const maxPrice = category.maxPrice || basePrice * 2;
        const priceRange = maxPrice - basePrice;
        
        price = basePrice + (priceRange * increaseFactor);
        price = Math.round(Math.min(maxPrice, Math.max(basePrice, price)) * 100) / 100;
        availableSeats = category.availableSeats;
      }
    } else {
      // Apply gradual pricing to base price
      const basePrice = price;
      const maxPrice = basePrice * 2;
      const priceRange = maxPrice - basePrice;
      
      price = basePrice + (priceRange * increaseFactor);
      price = Math.round(Math.min(maxPrice, Math.max(basePrice, price)) * 100) / 100;
    }

    if (availableSeats < parsedQuantity) {
      return res.status(400).json({ error: `Only ${availableSeats} tickets available` });
    }

    console.log(`✅ Creating ticket: Qty=${parsedQuantity}, Price=${price}, Total=${price * parsedQuantity}`);

    // Use MongoDB transaction to ensure atomicity
    const session = await mongoose.startSession();
    let ticket = null;
    
    try {
      await session.withTransaction(async () => {
        // Create ticket within transaction
        const ticketData = {
          eventId: event._id,
          userId: req.user.id,
          quantity: parsedQuantity,
          price: price,
          totalAmount: price * parsedQuantity,
          categoryName: categoryName || 'standard',
          customerName: customerName,
          customerEmail: customerEmail,
          purchaseDate: new Date(),
          status: 'confirmed',
          bookingReference: `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        };
        
        const tickets = await Ticket.create([ticketData], { session });
        ticket = tickets[0];

        // Update event inventory within the same transaction
        if (categoryName && event.ticketCategories) {
          const categoryIndex = event.ticketCategories.findIndex(c => c.name === categoryName);
          if (categoryIndex !== -1) {
            event.ticketCategories[categoryIndex].availableSeats -= parsedQuantity;
            console.log(`📉 Updated ${categoryName} seats: ${event.ticketCategories[categoryIndex].availableSeats + parsedQuantity} -> ${event.ticketCategories[categoryIndex].availableSeats}`);
          }
        }
        
        // Recalculate ticketsSold and availableTickets from category data
        if (event.ticketCategories && event.ticketCategories.length > 0) {
          const totalSeats = event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
          const totalAvailable = event.ticketCategories.reduce((sum, cat) => sum + cat.availableSeats, 0);
          event.capacity = totalSeats;
          event.availableTickets = totalAvailable;
          event.ticketsSold = totalSeats - totalAvailable;
        } else {
          event.availableTickets -= parsedQuantity;
          event.ticketsSold += parsedQuantity;
        }
        
        event.totalRevenue += ticket.totalAmount;
        await event.save({ session });
      });
    } finally {
      await session.endSession();
    }

    // Clear cache (outside transaction - non-critical)
    try {
      await cacheService.invalidatePattern(`tickets:user:${req.user.id}`);
      await cacheService.invalidatePattern(`event:${eventId}`);
    } catch (e) {
      // Cache errors are non-critical
    }

    res.status(201).json({
      message: 'Ticket purchased successfully',
      bookingReference: ticket.bookingReference,
      ticket: ticket,
      _id: ticket._id
    });

  } catch (error) {
    console.error('Error purchasing ticket:', error.message, error.stack);
    res.status(500).json({ error: error.message || 'Error processing ticket purchase' });
  } finally {
    // Always release the lock
    if (lockAcquired) {
      await concurrencyService.releaseLock(lockKey);
    }
  }
});

// Legacy /purchase endpoint - redirects to main POST / endpoint for backwards compatibility
// @deprecated Use POST / instead
router.post('/purchase', protect, (req, res, next) => {
  console.log('⚠️ /purchase endpoint is deprecated, use POST /tickets instead');
  // Forward to main ticket purchase handler
  router.handle(Object.assign(req, { url: '/', method: 'POST' }), res, next);
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
    // Process purchases with concurrency limit
    const results = await concurrencyService.batchProcess(
      purchases,
      async (purchase) => {
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
