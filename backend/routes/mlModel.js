const express = require('express');
const router = express.Router();
const PredictionLog = require('../models/PredictionLog');
const MLModel = require('../models/MLModel');

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

// @route   POST /api/ml-model/update-metadata
// @desc    Update or create ML model metadata from training results
// @access  Private (Internal/Admin)
router.post('/update-metadata', async (req, res) => {
  try {
    const modelData = req.body;
    
    if (!modelData.modelVersion) {
      return res.status(400).json({ error: 'modelVersion is required' });
    }

    // Set all other models to inactive if this one is being activated
    if (modelData.isActive !== false) {
      await MLModel.updateMany({}, { isActive: false });
    }

    // Update if exists (by modelVersion), otherwise create
    const updatedModel = await MLModel.findOneAndUpdate(
      { modelVersion: modelData.modelVersion },
      { 
        ...modelData,
        isActive: modelData.isActive !== false,
        trainedAt: modelData.metadata?.trainedAt || new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Model metadata updated successfully',
      data: updatedModel
    });
  } catch (error) {
    console.error('Error updating model metadata:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
