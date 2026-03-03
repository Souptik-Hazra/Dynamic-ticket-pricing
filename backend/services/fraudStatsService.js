
const Ticket = require('../models/Ticket');
const UserFraudStats = require('../models/UserFraudStats');
const User = require('../models/User');
const axios = require('axios');


// Call Python ML API for fraud detection
async function getFraudDetection(transaction) {
  try {
    const response = await axios.post('http://localhost:5000/fraud/detect', transaction, { timeout: 2000 });
    if (response.data && response.data.fraud_detection) {
      return response.data.fraud_detection;
    }
  } catch (e) {
    console.error('Python fraud API error:', e.message);
  }
  return null;
}

async function calculateFraudStats(user, tickets) {
  const totalPurchases = tickets.length;
  const totalTickets = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
  const totalSpent = tickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  const avgQty = totalPurchases > 0 ? totalTickets / totalPurchases : 0;

  let fraudScores = [];
  let allReasons = new Set();
  let lastFlagged = null;

  for (const t of tickets) {
    const transaction = {
      quantity: t.quantity || 1,
      amount: t.totalAmount || 0,
      user_purchase_frequency: totalPurchases - 1,
      time_of_day: t.purchaseDate ? new Date(t.purchaseDate).getHours() : 12,
      day_of_week: t.purchaseDate ? new Date(t.purchaseDate).getDay() : 0,
      account_age_days: user && user.createdAt ? Math.floor((Date.now() - new Date(user.createdAt)) / (1000*60*60*24)) : 365
    };
    const result = await getFraudDetection(transaction);
    if (result) {
      fraudScores.push(result.fraud_score);
      (result.reasons || []).forEach(r => allReasons.add(r));
      if (result.fraud_score >= 60) lastFlagged = t.purchaseDate;
    }
  }

  const avgFraudScore = fraudScores.length ? fraudScores.reduce((a,b) => a+b,0)/fraudScores.length : 0;
  let riskLevel = 'LOW';
  if (avgFraudScore >= 60) riskLevel = 'HIGH';
  else if (avgFraudScore >= 35) riskLevel = 'MEDIUM';

  return {
    fraudScore: avgFraudScore,
    riskLevel,
    totalPurchases,
    totalTickets,
    avgQtyPerPurchase: avgQty,
    totalSpent,
    flaggedReasons: Array.from(allReasons),
    lastFlaggedAt: lastFlagged,
    updatedAt: new Date()
  };
}


async function updateUserFraudStats(userId) {
  const user = await User.findById(userId);
  if (!user) return;
  const tickets = await Ticket.find({ userId });
  const stats = await calculateFraudStats(user, tickets);
  await UserFraudStats.findOneAndUpdate(
    { userId },
    { $set: stats },
    { upsert: true }
  );
}

module.exports = { updateUserFraudStats };
