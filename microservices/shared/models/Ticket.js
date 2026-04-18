import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema(
  {
    eventId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User',  required: true, index: true },
    categoryId:   { type: mongoose.Schema.Types.ObjectId },
    categoryName: { type: String, default: 'standard', lowercase: true, trim: true },

    // Buyer details (snapshot — not a live reference)
    customerName:  { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },

    // Pricing
    pricePerTicket: { type: Number, required: true, min: 0 },
    quantity:       { type: Number, required: true, min: 1, max: 15 },
    totalAmount:    { type: Number, required: true },               // pricePerTicket × quantity

    status:           { type: String, enum: ['confirmed', 'cancelled', 'refunded'], default: 'confirmed' },
    bookingReference: { type: String, unique: true, sparse: true }, // generated in pre-save
    purchaseDate:     { type: Date, default: Date.now },

    // QR Ticket Security
    qrToken: { type: String, unique: true, sparse: true, index: true },
    qrCode:  { type: String }, // Base64 encoded branded QR code
    isUsed:  { type: Boolean, default: false },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

/* ── Pre-save: auto-generate booking reference ───────────────────────────── */
ticketSchema.pre('save', async function () {
  if (!this.bookingReference) {
    const ts   = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.bookingReference = `FF-${ts}-${rand}`;
  }
});

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
export default Ticket;
