const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  role: {
    type: String,
    enum: ['user', 'model'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    predictionLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PredictionLog'
    },
    geminiModel: {
      type: String,
      default: 'gemini-2.5-flash'
    },
    promptTokens: Number,
    candidateTokens: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

chatMessageSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
