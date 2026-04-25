import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    type: { type: String, enum: ['ticket_purchase', 'event_update', 'price_change', 'subscription', 'system', 'refund', 'message'], default: 'system' },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
