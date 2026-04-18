import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  eventId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Event' },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentMethod: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Payment', PaymentSchema);
