const express = require('express');
const router = express.Router();
const axios = require('axios');
const Event = require('../models/Event');
const PriceHistory = require('../models/PriceHistory');
const PredictionLog = require('../models/PredictionLog');

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

const getCategoryTier = (categoryName) => {
  // Map category names to pricing tiers
  // 1 = economy (cheapest), 2 = standard, 3 = vip, 4 = premium (most expensive)
  const tierMap = {
    'economy': 1,
    'standard': 2,
    'balcony': 2,
    'vip': 3,
    'premium': 4
  };
  return tierMap[categoryName.toLowerCase()] || 2; // default to standard
};

// @route   GET /api/events
// @desc    Get all events
// @access  Public
router.get('/', async (req, res) => {
  try {
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
    
    res.json(publicEvents);
  } 
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id/dynamic-prices
// @desc    Get dynamic prices for all ticket categories (ML-powered)
// @access  Public
router.get('/:id/dynamic-prices', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Calculate demand factors
    const occupancyRate = event.capacity > 0 ? event.ticketsSold / event.capacity : 0;
    const demand = Math.round(event.capacity * occupancyRate * 2);
    const historicalSales = event.ticketsSold;
    const daysUntilEvent = event.daysUntilEvent;

    // Calculate event duration
    const eventDuration = event.endDate ? 
      Math.max(1, Math.ceil((new Date(event.endDate) - new Date(event.startDate)) / (1000 * 60 * 60 * 24))) : 
      1;

    const eventHour = new Date(event.startDate).getHours();

    // Prepare category data
    const categories = event.ticketCategories && event.ticketCategories.length > 0
      ? event.ticketCategories.map(cat => ({
          name: cat.name,
          tier: getCategoryTier(cat.name),
          basePrice: cat.price
        }))
      : [{ name: 'standard', tier: 2, basePrice: event.basePrice || 100 }];

    // Call ML API for category-aware pricing
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
      categories: categories
    };

    let prices = {};
    try {
      const response = await axios.post(`${ML_API_URL}/predict-categories`, features);
      prices = response.data.category_prices || {};
    } catch (mlError) {
      console.warn('ML prediction failed, using fallback pricing:', mlError.message);
      // Fallback: Use simple multiplier-based pricing if ML fails
      if (event.ticketCategories && event.ticketCategories.length > 0) {
        event.ticketCategories.forEach(category => {
          const basePrice = category.price;
          const maxPrice = category.maxPrice || basePrice * 2;
          const priceRange = maxPrice - basePrice;
          const increaseFactor = (occupancyRate * 0.5) + ((event.eventPopularity || 0.5) * 0.5);
          const dynamicPrice = basePrice + (priceRange * increaseFactor);
          prices[category.name] = Math.round(Math.min(maxPrice, Math.max(basePrice, dynamicPrice)) * 100) / 100;
        });
      } else {
        const basePrice = event.basePrice || 100;
        const increaseFactor = (occupancyRate * 0.5) + ((event.eventPopularity || 0.5) * 0.5);
        prices['standard'] = Math.round(basePrice * (1 + increaseFactor * 0.5) * 100) / 100;
      }
    }

    res.json({
      eventId: event._id,
      prices,
      factors: {
        occupancyRate: Math.round(occupancyRate * 100),
        ticketsSold: event.ticketsSold,
        capacity: event.capacity,
        demandLevel: occupancyRate > 0.8 ? 'high' : occupancyRate > 0.5 ? 'medium' : 'low'
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

    // Prepare features for ML model with category information
    const categories = event.ticketCategories && event.ticketCategories.length > 0
      ? event.ticketCategories.map(cat => ({
          name: cat.name,
          tier: getCategoryTier(cat.name),
          basePrice: cat.price
        }))
      : [{ name: 'standard', tier: 2, basePrice: event.basePrice || 100 }];

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
      categories: categories
    };

    // Call ML API for category-aware price prediction
    const response = await axios.post(`${ML_API_URL}/predict-categories`, features);
    const categoryPrices = response.data.category_prices || {};
    const basePredictedPrice = response.data.base_price;

    // Update event's current price
    event.currentPrice = basePredictedPrice;
    await event.save();

    // Save to price history per category with ML-predicted prices
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      for (const category of event.ticketCategories) {
        const priceHistory = new PriceHistory({
          event: event._id,
          categoryName: category.name,
          price: categoryPrices[category.name] || category.price,
          demand: demand,
          occupancyRate: occupancyRate,
          daysUntilEvent: daysUntilEvent,
          factors: {
            eventPopularity: event.eventPopularity,
            competitorPrice: features.competitor_price,
            historicalSales: historicalSales,
            season: features.season,
            dayOfWeek: features.day_of_week,
            mlPredicted: true
          }
        });
        await priceHistory.save();
      }
    } else {
      const priceHistory = new PriceHistory({
        event: event._id,
        categoryName: 'standard',
        price: basePredictedPrice,
        demand: demand,
        occupancyRate: occupancyRate,
        daysUntilEvent: daysUntilEvent,
        factors: {
          eventPopularity: event.eventPopularity,
          competitorPrice: features.competitor_price,
          historicalSales: historicalSales,
          season: features.season,
          dayOfWeek: features.day_of_week,
          mlPredicted: true
        }
      });
      await priceHistory.save();
    }

    // Log prediction with category prices
    const predictionLog = new PredictionLog({
      event: event._id,
      inputFeatures: {
        demand: features.demand,
        capacity: features.capacity,
        daysUntilEvent: features.days_until_event,
        eventDuration: features.event_duration_days,
        eventPopularity: features.event_popularity,
        competitorPrice: features.competitor_price,
        historicalSales: features.historical_sales,
        season: features.season,
        dayOfWeek: features.day_of_week,
        hourOfDay: features.hour_of_day,
        isHoliday: features.is_holiday,
        venueTier: features.venue_tier,
        artistTier: features.artist_tier,
        categories: features.categories
      },
      predictedPrice: basePredictedPrice,
      categoryPrices: categoryPrices,
      priceRange: response.data.price_range,
      confidence: response.data.confidence,
      modelVersion: response.data.model_version || 'v1.0'
    });
    await predictionLog.save();

    res.json({
      event_id: event._id,
      event_name: event.name,
      current_price: predictedPrice,
      price_range: response.data.price_range,
      features: features,
      confidence: response.data.confidence
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
