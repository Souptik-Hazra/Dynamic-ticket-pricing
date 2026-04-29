import mongoose from 'mongoose';
import bus from '../../../shared/utils/bus.js';
import { createLogger } from '../../../shared/utils/logger.js';

/**
 * 📊 Materialized Stats Service (Projection Pattern)
 * 
 * Subscribes to the Event Bus and maintains pre-aggregated statistics
 * in a specialized 'DailyStats' collection for instant dashboard rendering.
 */

const dailyStatsSchema = new mongoose.Schema({
  date: { type: String, unique: true }, // YYYY-MM-DD
  totalRevenue: { type: Number, default: 0 },
  totalAiSurplus: { type: Number, default: 0 }, // Revenue generated above base price (Phase 7)
  totalTickets: { type: Number, default: 0 },
  eventCount: { type: Number, default: 0 },
  topEvents: [{ eventId: String, name: String, revenue: Number }]
});

const DailyStats = mongoose.models.DailyStats || mongoose.model('DailyStats', dailyStatsSchema);

export const initStatsSync = () => {
  const logger = createLogger('StatsSync');
  logger.info('Initializing projection listeners...');

  // 1. Sync on Payment Success
  bus.subscribe('payment.success', async (payload) => {
    const today = new Date().toISOString().split('T')[0];
    const surplus = payload.surplus || 0; // The difference between paid price and base price
    try {
      await DailyStats.findOneAndUpdate(
        { date: today },
        { 
          $inc: { 
            totalRevenue: payload.amount, 
            totalAiSurplus: surplus,
            totalTickets: payload.quantity || 1 
          } 
        },
        { upsert: true }
      );
    } catch (err) {
      logger.error('Payment sync failed', err);
    }
  });

  // 2. Sync on Event Creation
  bus.subscribe('event.created', async (payload) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      await DailyStats.findOneAndUpdate(
        { date: today },
        { $inc: { eventCount: 1 } },
        { upsert: true }
      );
    } catch (err) {
      logger.error('Event sync failed', err);
    }
  });
};

export const getInstantStats = async () => {
  const today = new Date().toISOString().split('T')[0];
  return await DailyStats.findOne({ date: today }) || { totalRevenue: 0, totalTickets: 0, eventCount: 0 };
};

export default { initStatsSync, getInstantStats };
