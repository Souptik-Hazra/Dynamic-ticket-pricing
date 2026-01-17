const express = require('express');
const router = express.Router();
const PredictionLog = require('../models/PredictionLog');

// @route   POST /api/ml-model/prediction-log
// @desc    Log a prediction (for ML model tracking)
// @access  Public
router.post('/prediction-log', async (req, res) => {
  try {
    const {
      event,
      inputFeatures,
      predictedPrice,
      priceRange,
      confidence,
      modelVersion
    } = req.body;

    const predictionLog = await PredictionLog.create({
      event,
      inputFeatures,
      predictedPrice,
      priceRange,
      confidence,
      modelVersion: modelVersion || 'v1.0'
    });

    res.status(201).json({
      success: true,
      data: predictionLog
    });
  } catch (error) {
    console.error('Error logging prediction:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
