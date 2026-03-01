// Fraud detection configuration constants
module.exports = {
  // Bulk purchase detection
  BULK_PURCHASE_THRESHOLD: 15,
  BULK_PURCHASE_SCORE: 35,
  
  HIGH_QUANTITY_THRESHOLD: 10,
  HIGH_QUANTITY_SCORE: 20,
  
  // Purchase frequency detection
  HIGH_PURCHASE_FREQUENCY_THRESHOLD: 5,
  HIGH_PURCHASE_FREQUENCY_SCORE: 25,
  
  FREQUENT_PURCHASER_THRESHOLD: 3,
  FREQUENT_PURCHASER_SCORE: 15,
  
  // Average tickets per purchase
  AVG_TICKETS_THRESHOLD: 10,
  AVG_TICKETS_SCORE: 20,
  
  // Purchase velocity (in days)
  VELOCITY_WINDOW_DAYS: 7,
  RAPID_PURCHASES_THRESHOLD: 3,
  RAPID_PURCHASES_SCORE: 15,
  
  // High spending detection
  HIGH_SPENDING_THRESHOLD: 50000,
  HIGH_SPENDING_SCORE: 10,
  
  // Risk level thresholds
  HIGH_RISK_THRESHOLD: 60,
  MEDIUM_RISK_THRESHOLD: 35,
  MAX_FRAUD_SCORE: 100,
  
  // Analytics
  TOP_RISKY_USERS_LIMIT: 50,
  TIMELINE_DAYS: 30
};
