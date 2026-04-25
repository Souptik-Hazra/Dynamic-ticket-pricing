import mongoose from 'mongoose';
import Event from '../src/modules/catalog/model/event.model.js';
import config from '../src/shared/config/index.js';

/**
 * 📊 Diamond ROI Reporter (Phase 14: Self-Driving)
 * 
 * Automatically analyzes all events to calculate the "AI Revenue Surplus".
 * Generates a clean, actionable report of algorithmic performance.
 */

const MONGO_URI = config.mongodb.uri || 'mongodb://localhost:27017/fanfever';

const report = async () => {
  console.log('📊 Generating Weekly Diamond ROI Report...');
  await mongoose.connect(MONGO_URI);
  
  const events = await Event.find({});
  let totalAiSurplus = 0;
  let totalBaseRevenue = 0;

  console.log('\n--- EVENT PERFORMANCE BREAKDOWN ---');
  events.forEach(e => {
    totalAiSurplus += (e.profitAmount || 0);
    totalBaseRevenue += (e.baseRevenue || 0);
    
    if (e.profitAmount > 0) {
      console.log(`✅ ${e.name.padEnd(40)} | AI Surplus: ₹${String(e.profitAmount).padEnd(10)} | Gain: ${e.profitPercentage.toFixed(2)}%`);
    }
  });

  console.log('\n--- GLOBAL FINANCIAL SUMMARY ---');
  console.log(`💰 Total Base Revenue:  ₹${totalBaseRevenue.toLocaleString()}`);
  console.log(`💎 Total AI Surplus:   ₹${totalAiSurplus.toLocaleString()}`);
  console.log(`📈 Platform Efficiency: ${((totalAiSurplus / (totalBaseRevenue || 1)) * 100).toFixed(2)}%`);
  console.log('--------------------------------\n');

  process.exit(0);
};

report().catch(err => {
  console.error('❌ Report failed:', err);
  process.exit(1);
});
