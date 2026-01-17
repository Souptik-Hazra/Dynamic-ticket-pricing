const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  demand: {
    type: Number,
    required: true
  },
  occupancyRate: {
    type: Number,
    required: true
  },
  daysUntilEvent: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  factors: {
    eventPopularity: Number,
    competitorPrice: Number,
    historicalSales: Number,
    season: Number,
    dayOfWeek: Number
  }
});

// Create index for efficient queries
priceHistorySchema.index({ event: 1, timestamp: -1 });

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
