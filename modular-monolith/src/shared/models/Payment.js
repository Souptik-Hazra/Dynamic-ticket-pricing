import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    bookingReference: { type: String, trim: true },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'cash'], required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String, unique: true, sparse: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.pre('save', function () {
  if (!this.transactionId) {
    this.transactionId = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  }
});

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export default Payment;
