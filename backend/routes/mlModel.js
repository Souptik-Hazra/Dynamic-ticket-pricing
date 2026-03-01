const express = require('express');
const router = express.Router();
const axios = require('axios');
const { PricePrediction } = require('../models/MLModel');
const { protect, admin } = require('../middleware/auth');

// ML API Base URL - runs on port 5000 by default
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5000';

// @route   POST /api/ml/predict-price
// @desc    Predict ticket price using ML model
// @access  Private/Admin
router.post('/predict-price', protect, admin, async (req, res) => {
  try {
    const {
      eventId,
      demand,
      capacity,
      daysUntilEvent,
      eventDurationDays,
      eventPopularity,
      competitorPrice,
      historicalSales,
      season,
      dayOfWeek,
      hourOfDay,
      isWeekend,
      isHoliday,
      venueTier,
      artistTier
    } = req.body;

    // Validate input
    if (!demand || !capacity) {
      return res.status(400).json({ error: 'Missing required fields: demand, capacity' });
    }

    // Call Python ML API
    const response = await axios.post(`${ML_API_URL}/predict`, {
      demand,
      capacity,
      days_until_event: daysUntilEvent || 30,
      event_duration_days: eventDurationDays || 1,
      event_popularity: eventPopularity || 0.5,
      competitor_price: competitorPrice || 100,
      historical_sales: historicalSales || 50,
      season: season || 1,
      day_of_week: dayOfWeek || 1,
      hour_of_day: hourOfDay || 12,
      is_weekend: isWeekend || 0,
      is_holiday: isHoliday || 0,
      venue_tier: venueTier || 2,
      artist_tier: artistTier || 3
    });

    // Store in MongoDB for audit trail
    const prediction = new PricePrediction({
      eventId,
      inputFeatures: {
        demand,
        capacity,
        daysUntilEvent,
        eventDurationDays,
        eventPopularity,
        competitorPrice,
        historicalSales,
        season,
        dayOfWeek,
        hourOfDay,
        isWeekend,
        isHoliday,
        venueTier,
        artistTier
      },
      predictedPrice: response.data.predicted_price,
      priceRange: response.data.price_range,
      confidence: response.data.confidence,
      modelVersion: response.data.model_version
    });

    await prediction.save();

    res.json({
      success: true,
      prediction: {
        predictedPrice: response.data.predicted_price,
        priceRange: response.data.price_range,
        confidence: response.data.confidence,
        currency: response.data.currency,
        modelVersion: response.data.model_version,
        predictionId: prediction._id,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Price prediction error:', error.message);
    
    // Check if ML API is unavailable
    if (error.message === 'connect ECONNREFUSED') {
      return res.status(503).json({
        error: 'ML API service unavailable. Make sure the Python ML server is running on port 5000',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Price prediction failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// @route   POST /api/ml/detect-fraud
// @desc    Use /api/admin/fraud-analytics for fraud detection (inbuilt)
// @access  DEPRECATED - Use built-in fraud analytics instead

// @route   POST /api/ml/batch-predict
// @desc    Predict prices for multiple scenarios
// @access  Private/Admin
router.post('/batch-predict', protect, admin, async (req, res) => {
  try {
    const { scenarios } = req.body;

    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return res.status(400).json({ error: 'Invalid scenarios provided' });
    }

    if (scenarios.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 scenarios allowed' });
    }

    // Call Python ML API
    const response = await axios.post(`${ML_API_URL}/batch-predict`, {
      scenarios: scenarios.map(scenario => ({
        name: scenario.name || 'Unnamed',
        demand: scenario.demand || 100,
        capacity: scenario.capacity || 1000,
        days_until_event: scenario.daysUntilEvent || 30,
        event_duration_days: scenario.eventDurationDays || 1,
        event_popularity: scenario.eventPopularity || 0.5,
        competitor_price: scenario.competitorPrice || 100,
        historical_sales: scenario.historicalSales || 50,
        season: scenario.season || 1,
        day_of_week: scenario.dayOfWeek || 1,
        hour_of_day: scenario.hourOfDay || 12,
        is_weekend: scenario.isWeekend || 0,
        is_holiday: scenario.isHoliday || 0,
        venue_tier: scenario.venueTier || 2,
        artist_tier: scenario.artistTier || 3
      }))
    });

    res.json({
      success: true,
      predictions: response.data.predictions,
      count: response.data.count,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Batch prediction error:', error.message);
    
    if (error.message === 'connect ECONNREFUSED') {
      return res.status(503).json({
        error: 'ML API service unavailable',
        details: error.message
      });
    }

    res.status(500).json({
      error: 'Batch prediction failed',
      details: error.response?.data?.error || error.message
    });
  }
});

// @route   GET /api/ml/prediction-history
// @desc    Get price prediction history for an event
// @access  Private/Admin
router.get('/prediction-history/:eventId', protect, admin, async (req, res) => {
  try {
    const predictions = await PricePrediction.find({ eventId: req.params.eventId })
      .sort({ predictedAt: -1 })
      .limit(50);

    res.json({
      success: true,
      predictionHistory: predictions
    });
  } catch (error) {
    console.error('Prediction history error:', error);
    res.status(500).json({ error: 'Failed to fetch prediction history' });
  }
});

// @route   GET /api/ml/health
// @desc    Check ML API health
// @access  Public
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${ML_API_URL}/health`, { timeout: 5000 });
    
    res.json({
      success: true,
      mlApiStatus: response.data,
      backendTime: new Date()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'ML API is not responding',
      details: error.message,
      mlApiUrl: ML_API_URL
    });
  }
});

module.exports = router;
