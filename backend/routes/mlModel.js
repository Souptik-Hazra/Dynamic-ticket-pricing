const express = require('express');
const router = express.Router();
const PredictionLog = require('../models/PredictionLog');
const MLModel = require('../models/MLModel');
const cacheService = require('../services/cacheService');

// @route   POST /api/ml-model/update-metadata
// @desc    Update ML model metadata after training (called by train_model_enhanced.py)
// @access  Public (internal service call)
router.post('/update-metadata', async (req, res) => {
  try {
    const { modelVersion, modelType, features, trainScore, testScore, parameters, metadata } = req.body;

    if (!modelVersion) {
      return res.status(400).json({ error: 'modelVersion is required' });
    }

    // Deactivate all previous models
    await MLModel.updateMany({}, { isActive: false });

    // Create or update the model entry
    const modelData = {
      modelVersion,
      modelType: modelType || 'XGBoostRegressor',
      features: features || [],
      trainScore: trainScore || 0,
      testScore: testScore || 0,
      parameters: parameters || {},
      metadata: metadata || {},
      isActive: true,
      trainedAt: metadata?.trainedAt ? new Date(metadata.trainedAt) : new Date()
    };

    const mlModel = await MLModel.findOneAndUpdate(
      { modelVersion },
      modelData,
      { upsert: true, new: true }
    );

    console.log(`✅ ML Model ${modelVersion} synced to MongoDB`);

    // Invalidate active model cache
    await cacheService.del('mlmodel:active');

    res.status(200).json({
      success: true,
      message: `Model ${modelVersion} updated successfully`,
      data: mlModel
    });
  } catch (error) {
    console.error('Error updating ML model metadata:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/ml-model/active
// @desc    Get currently active ML model info
// @access  Public
router.get('/active', async (req, res) => {
  try {
    // Try to get from cache first
    const cacheKey = 'mlmodel:active';
    const cachedModel = await cacheService.get(cacheKey);
    if (cachedModel) {
      return res.json(cachedModel);
    }

    const activeModel = await MLModel.findOne({ isActive: true });
    if (!activeModel) {
      return res.status(404).json({ error: 'No active model found' });
    }

    const result = { success: true, data: activeModel };
    // Cache for 1 hour (model rarely changes)
    await cacheService.set(cacheKey, result, 3600);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/ml-model/prediction-log
// @desc    Log a prediction (for ML model tracking)
// @access  Public
router.post('/prediction-log', async (req, res) => {
  try {
    const {
      event,
      inputFeatures,
      predictedPrice,
      xgboostFeatureImportance,
      geminiExplanation,
      priceRange,
      confidence,
      modelVersion
    } = req.body;

    const predictionLog = await PredictionLog.create({
      event,
      inputFeatures,
      predictedPrice,
      xgboostFeatureImportance,
      geminiExplanation,
      priceRange,
      confidence,
      modelVersion: modelVersion || 'XGBoost-v1.0'
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
