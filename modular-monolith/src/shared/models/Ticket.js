import mongoose from 'mongoose';
import { createBookingReference } from '../utils.js';

const ticketSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId },
    categoryName: { type: String, default: 'standard', lowercase: true, trim: true },
    seatNumber: { type: String },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
    pricePerTicket: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 15 },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending_payment', 'confirmed', 'cancelled', 'refunded'], default: 'pending_payment' },
    bookingReference: { type: String, unique: true, sparse: true },
    purchaseDate: { type: Date, default: Date.now },
    qrToken: { type: String, unique: true, sparse: true, index: true },
    qrCode: { type: String },
    isUsed: { type: Boolean, default: false },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

ticketSchema.index({ eventId: 1, status: 1 });
ticketSchema.index({ purchaseDate: -1 });

ticketSchema.pre('save', async function () {
  if (!this.bookingReference) {
    this.bookingReference = createBookingReference();
  }
});

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
export default Ticket;
