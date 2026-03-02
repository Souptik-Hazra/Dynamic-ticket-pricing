const mongoose = require('mongoose');

const userFraudStatsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fraudScore: { type: Number, default: 0 },
  riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
  totalPurchases: { type: Number, default: 0 },
  totalTickets: { type: Number, default: 0 },
  avgQtyPerPurchase: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  flaggedReasons: [{ type: String }],
  lastFlaggedAt: { type: Date },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserFraudStats', userFraudStatsSchema);
