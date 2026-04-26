import Metrics from '../model/metrics.model.js';
import Ledger from '../../payments/model/ledger.model.js';
import Event from '../../catalog/model/event.model.js';
import { cacheSet, cacheGet } from '../../../shared/utils/cache.js';

/**
 * 🧠 Intelligence Service (Phase 16)
 * 
 * Expert-level data aggregation logic. Periodically calculates
 * high-level business intelligence metrics and stores them as
 * materialized views for O(1) retrieval.
 */

export async function aggregateDailyRevenue() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const metricKey = `revenue:daily:${today.toISOString().split('T')[0]}`;

  // Use a lock to ensure only one worker performs aggregation
  const lock = await cacheGet(`lock:${metricKey}`);
  if (lock) return;
  await cacheSet(`lock:${metricKey}`, true, 300); // 5 min lock

  try {
    const result = await Ledger.aggregate([
      {
        $match: {
          timestamp: { $gte: today },
          type: 'CREDIT',
          category: 'PURCHASE'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalRevenue = result[0]?.total || 0;
    const purchaseCount = result[0]?.count || 0;

    await Metrics.findOneAndUpdate(
      { metricKey },
      { 
        value: totalRevenue, 
        type: 'REVENUE', 
        granularity: 'DAILY',
        metadata: { purchaseCount },
        timestamp: new Date()
      },
      { upsert: true }
    );

    console.log(`🧠 [Intelligence] Daily revenue aggregated: ₹${totalRevenue}`);
  } catch (err) {
    console.error('❌ [Intelligence] Revenue aggregation failed:', err.message);
  }
}

export async function aggregateEventOccupancy() {
  try {
    const activeEvents = await Event.find({ status: 'upcoming' });
    
    for (const event of activeEvents) {
      const occupancy = event.capacity > 0 ? (event.ticketsSold / event.capacity) * 100 : 0;
      const metricKey = `event:occupancy:${event._id}`;

      await Metrics.findOneAndUpdate(
        { metricKey },
        { 
          value: occupancy, 
          type: 'OCCUPANCY', 
          entityId: event._id,
          granularity: 'TOTAL',
          timestamp: new Date()
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error('❌ [Intelligence] Occupancy aggregation failed:', err.message);
  }
}

export default { aggregateDailyRevenue, aggregateEventOccupancy };
