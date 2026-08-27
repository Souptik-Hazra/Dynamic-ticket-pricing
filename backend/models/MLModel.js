// Dynamic Ticket Pricing System v2.0
const mongoose = require('mongoose');

const mlModelSchema = new mongoose.Schema({
  modelVersion: {
    type: String,
    required: true,
    unique: true
  },
  modelType: {
    type: String,
    enum: ['XGBoostRegressor', 'BERT_Sentiment_Analyzer'],
    default: 'XGBoostRegressor'
  },
  features: [{
    type: String
  }],
  trainedAt: {
    type: Date,
    default: Date.now
  },
  trainScore: {
    type: Number,
    required: true
  },
  testScore: {
    type: Number,
    required: true
  },
  parameters: {
    nEstimators: Number,
    learningRate: Number,
    maxDepth: Number,
    subsample: Number,
    randomState: Number,
    nSamples: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MLModel', mlModelSchema);
