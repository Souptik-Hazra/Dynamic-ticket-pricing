const mongoose = require('mongoose');

const predictionLogSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  inputFeatures: {
    demand: Number,
    capacity: Number,
    daysUntilEvent: Number,
    eventPopularity: Number,
    competitorPrice: Number,
    historicalSales: Number,
    season: Number,
    dayOfWeek: Number
  },
  predictedPrice: {
    type: Number,
    required: true
  },
  categoryPrices: {
    type: mongoose.Schema.Types.Mixed,  // {categoryName: price}
  },
  priceRange: {
    min: Number,
    max: Number
  },
  confidence: {
    type: Number,
    default: 0.95
  },
  modelVersion: {
    type: String,
    required: true
  },
  actualPrice: {
    type: Number  // To be filled later for model accuracy tracking
  },
  predictionAccuracy: {
    type: Number  // Calculated after actual price is known
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
predictionLogSchema.index({ event: 1, timestamp: -1 });
predictionLogSchema.index({ modelVersion: 1 });

module.exports = mongoose.model('PredictionLog', predictionLogSchema);
