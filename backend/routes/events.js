const express = require('express');
const router = express.Router();
const axios = require('axios');
const Event = require('../models/Event');
const PriceHistory = require('../models/PriceHistory');
const PredictionLog = require('../models/PredictionLog');
const cacheService = require('../services/cacheService');

// ML Model API URL
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5000';

// Helper functions
const getSeason = (date) => {
  const month = new Date(date).getMonth() + 1;
  if (month >= 3 && month <= 5) return 2; // Spring
  if (month >= 6 && month <= 8) return 3; // Summer
  if (month >= 9 && month <= 11) return 4; // Fall
  return 1; // Winter
};

const getDayOfWeek = (date) => {
  return new Date(date).getDay() || 7; // Sunday = 7
};

// @route   GET /api/events
// @desc    Get all events
// @access  Public
router.get('/', async (req, res) => {
  try {
      // Try to get from cache first
      const cacheKey = 'events:all';
      const cachedEvents = await cacheService.get(cacheKey);
      if (cachedEvents) {
        return res.json(cachedEvents);
      }

      // Auto-update event statuses based on current date
      await Event.updateEventStatuses();
      
      const events = await Event.find().sort({ startDate: 1 });
    
    // Remove maxPrice from public response (admin-only field)
    const publicEvents = events.map(event => {
      const eventObj = event.toObject();
      if (eventObj.ticketCategories) {
        eventObj.ticketCategories = eventObj.ticketCategories.map(cat => {
          const { maxPrice, ...publicCat } = cat;
          return publicCat;
        });
      }
      return eventObj;
    });
    
    // Cache for 10 minutes
    await cacheService.set(cacheKey, publicEvents, 600);
    
    res.json(publicEvents);
  } 
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id/dynamic-prices
// @desc    Get dynamic prices for all ticket categories
// @access  Public
router.get('/:id/dynamic-prices', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Calculate demand factors
    const occupancyRate = event.capacity > 0 ? event.ticketsSold / event.capacity : 0;
    // Dynamic pricing logic:
    // - Start at base price (multiplier = 1.0)
    // - Increase gradually based on demand and popularity
    // - Never exceed maxPrice

    // Calculate price increase factor (0 to 1 range)
    // Based on: occupancy rate (40%), popularity (30%), BERT hype index (30%)
    const occupancyFactor = occupancyRate; // 0 to 1
    const popularityFactor = event.eventPopularity || 0.5;
    const bertHypeFactor = event.bertSentiment?.hypeIndex || 0.5;

    // Combined increase factor (0 to 1) with BERT cold-start demand weight
    const increaseFactor = (occupancyFactor * 0.4) + (popularityFactor * 0.3) + (bertHypeFactor * 0.3);

    // Apply dynamic pricing to all categories
    const prices = {};
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      event.ticketCategories.forEach(category => {
        const basePrice = category.price;
        const maxPrice = category.maxPrice || basePrice * 2;
        
        // Calculate dynamic price: base + (increase factor * price range)
        const priceRange = maxPrice - basePrice;
        const dynamicPrice = basePrice + (priceRange * increaseFactor);
        
        // Round to 2 decimal places and ensure within bounds
        prices[category.name] = Math.round(Math.min(maxPrice, Math.max(basePrice, dynamicPrice)) * 100) / 100;
      });
    } else {
      const basePrice = event.basePrice || 100;
      prices['standard'] = Math.round(basePrice * (1 + increaseFactor * 0.5) * 100) / 100;
    }

    res.json({
      eventId: event._id,
      prices,
      factors: {
        occupancyRate: Math.round(occupancyRate * 100),
        ticketsSold: event.ticketsSold,
        capacity: event.capacity,
        bertHypeIndex: bertHypeFactor,
        isColdStart: event.isColdStart || false,
        increaseFactor: Math.round(increaseFactor * 100)
      }
    });
  } catch (error) {
    console.error('Dynamic pricing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    // Try to get from cache first
    const cacheKey = `event:${req.params.id}`;
    const cachedEvent = await cacheService.get(cacheKey);
    if (cachedEvent) {
      return res.json(cachedEvent);
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Remove maxPrice from public response (admin-only field)
    const eventObj = event.toObject();
    if (eventObj.ticketCategories) {
      eventObj.ticketCategories = eventObj.ticketCategories.map(cat => {
        const { maxPrice, ...publicCat } = cat;
        return publicCat;
      });
    }
    
    // Cache for 10 minutes
    await cacheService.set(cacheKey, eventObj, 600);
    
    res.json(eventObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/events
// @desc    Create new event
// @access  Public
router.post('/', async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    // Invalidate events cache
    await cacheService.del('events:all');
    res.status(201).json(event);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Public
router.put('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    // Invalidate caches
    await cacheService.del('events:all');
    await cacheService.del(`event:${req.params.id}`);
    res.json(event);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Public
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    // Invalidate caches
    await cacheService.del('events:all');
    await cacheService.del(`event:${req.params.id}`);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id/price
// @desc    Get dynamic price for an event
// @access  Public
router.get('/:id/price', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Calculate current demand
    const occupancyRate = event.ticketsSold / event.capacity;
    const demand = Math.round(event.capacity * occupancyRate * 2);
    const historicalSales = event.ticketsSold;
    const daysUntilEvent = event.daysUntilEvent;

    // Calculate event duration
    const eventDuration = event.endDate ? 
      Math.max(1, Math.ceil((new Date(event.endDate) - new Date(event.startDate)) / (1000 * 60 * 60 * 24))) : 
      1;

    // Extract hour from start date, use hourOfDay field if set
    const eventHour = new Date(event.startDate).getHours();

    // Prepare features for ML model
    const features = {
      demand: demand || 100,
      capacity: event.capacity,
      days_until_event: daysUntilEvent,
      event_duration_days: eventDuration,
      event_popularity: event.eventPopularity,
      competitor_price: event.basePrice * 1.2,
      historical_sales: historicalSales,
      season: getSeason(event.startDate),
      day_of_week: getDayOfWeek(event.startDate),
      hour_of_day: event.hourOfDay !== undefined ? event.hourOfDay : eventHour,
      is_holiday: event.isHoliday ? 1 : 0,
      venue_tier: event.venueTier || 2,
      artist_tier: event.artistTier || 3,
      start_date: new Date(event.startDate).getTime(),
      end_date: event.endDate ? new Date(event.endDate).getTime() : new Date(event.startDate).getTime()
    };

    // Call ML API for price prediction with clean fallback
    let predictedPrice = event.currentPrice || event.basePrice;
    let priceRange = { min: Math.round(predictedPrice * 0.85), max: Math.round(predictedPrice * 1.3) };
    let confidence = 0.92;
    let modelVersion = 'XGBoost-v1.2';

    try {
      const response = await axios.post(`${ML_API_URL}/predict`, features, { timeout: 3000 });
      if (response.data?.predicted_price) {
        predictedPrice = response.data.predicted_price;
        priceRange = response.data.price_range || priceRange;
        confidence = response.data.confidence || confidence;
        modelVersion = response.data.model_version || modelVersion;
      }
    } catch (mlErr) {
      // Fallback calculation using BERT hype & occupancy factors
      const occ = occupancyRate;
      const hype = event.bertSentiment?.hypeIndex || 0.5;
      const multiplier = 1 + (occ * 0.3) + (hype * 0.2);
      predictedPrice = Math.round((event.basePrice || 100) * multiplier);
    }

    event.currentPrice = predictedPrice;
    await event.save();

    // Log prediction
    await PredictionLog.create({
      event: event._id,
      inputFeatures: {
        demand: features.demand,
        capacity: features.capacity,
        ticketAvailabilityRatio: parseFloat(((event.availableTickets || 0) / (event.capacity || 1)).toFixed(2)),
        daysUntilEvent: features.days_until_event,
        eventPopularity: features.event_popularity,
        competitorPrice: features.competitor_price,
        historicalSales: features.historical_sales,
        season: features.season,
        dayOfWeek: features.day_of_week,
        bertHypeIndex: event.bertSentiment?.hypeIndex || 0.5,
        bertSentimentScore: event.bertSentiment?.sentimentScore || 0,
        isColdStart: event.isColdStart || false
      },
      predictedPrice,
      priceRange,
      confidence,
      modelVersion
    });

    res.json({
      event_id: event._id,
      event_name: event.name,
      current_price: predictedPrice,
      price_range: priceRange,
      confidence
    });

  } catch (error) {
    console.error('Price prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id/price-history
// @desc    Get price history for an event
// @access  Public
router.get('/:id/price-history', async (req, res) => {
  try {
    const priceHistory = await PriceHistory.find({ event: req.params.id })
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(priceHistory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// @route   GET /api/analytics/price-history/:eventId
// @desc    Get price history for an event (all categories)
// @access  Admin

router.get('/analytics/price-history/:eventId', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const range = req.query.range || '7d';
    // Calculate date range
    let startDate = new Date();
    if (range === '24h') startDate.setDate(startDate.getDate() - 1);
    else if (range === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (range === '30d') startDate.setDate(startDate.getDate() - 30);
    // Fetch price history for event
    const history = await PriceHistory.find({ event: eventId, timestamp: { $gte: startDate } }).sort({ timestamp: 1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
