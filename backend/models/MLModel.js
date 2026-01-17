const mongoose = require('mongoose');

const mlModelSchema = new mongoose.Schema({
  modelVersion: {
    type: String,
    required: true,
    unique: true
  },
  modelType: {
    type: String,
    default: 'RandomForestRegressor'
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
