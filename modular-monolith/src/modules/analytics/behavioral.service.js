import mongoose from 'mongoose';

/**
 * 🕵️ Behavioral Audit Service
 * 
 * Captures "Intent" signals from users before they purchase.
 * Used for funnel analysis and training future ML models.
 */

const intentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', index: true },
  action: { type: String, enum: ['view_price', 'select_category', 'add_to_cart', 'abandon_checkout'] },
  metadata: { type: Object },
  timestamp: { type: Date, default: Date.now }
});

const Intent = mongoose.models.Intent || mongoose.model('Intent', intentSchema);

export const logIntent = async (userId, eventId, action, metadata = {}) => {
  try {
    // We use a fire-and-forget approach or small buffer to avoid blocking the main thread
    await Intent.create({ userId, eventId, action, metadata });
  } catch (err) {
    console.error('[Behavioral] Log failed:', err.message);
  }
};

export const getFunnelStats = async (eventId) => {
  return await Intent.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(eventId) } },
    { $group: { _id: '$action', count: { $sum: 1 } } }
  ]);
};

export default { logIntent, getFunnelStats };
