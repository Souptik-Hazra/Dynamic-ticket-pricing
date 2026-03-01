const mongoose = require('mongoose');

// Price Prediction Schema
const pricePredictionSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  inputFeatures: {
    demand: Number,
    capacity: Number,
    daysUntilEvent: Number,
    eventDurationDays: Number,
    eventPopularity: Number,
    competitorPrice: Number,
    historicalSales: Number,
    season: Number,
    dayOfWeek: Number,
    hourOfDay: Number,
    isWeekend: Number,
    isHoliday: Number,
    venueTier: Number,
    artistTier: Number
  },
  predictedPrice: {
    type: Number,
    required: true
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
  currency: {
    type: String,
    default: 'INR'
  },
  predictedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
pricePredictionSchema.index({ eventId: 1, predictedAt: -1 });
pricePredictionSchema.index({ modelVersion: 1 });

// Models
const PricePrediction = mongoose.model('PricePrediction', pricePredictionSchema);

module.exports = {
  PricePrediction
};
