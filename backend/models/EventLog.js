const mongoose = require('mongoose');

const eventLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['TICKET_PURCHASE', 'ANALYTICS_EVENT', 'NOTIFICATION'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  error: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  processedAt: Date
});

module.exports = mongoose.model('EventLog', eventLogSchema);
