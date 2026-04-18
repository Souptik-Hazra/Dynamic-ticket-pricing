import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  eventId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  categoryId:       { type: mongoose.Schema.Types.ObjectId },
  categoryName:     { type: String, default: 'standard', lowercase: true },

  // Buyer info
  customerName:     { type: String, required: true, trim: true },
  customerEmail:    { type: String, required: true, lowercase: true, trim: true },

  // Aliases used by AdminDashboard
  buyerName:        { type: String },
  buyerEmail:       { type: String },

  // Pricing
  pricePerTicket:   { type: Number, required: true },
  quantity:         { type: Number, required: true, min: 1, max: 15 },
  totalAmount:      { type: Number },
  price:            { type: Number }, // alias for pricePerTicket

  // Reference populated by virtual populate
  eventName:        { type: String },

  status:           { type: String, enum: ['confirmed', 'cancelled', 'refunded'], default: 'confirmed' },
  bookingReference: { type: String, unique: true },
  purchaseDate:     { type: Date, default: Date.now }
});

// Auto-compute derived fields before save
TicketSchema.pre('save', function(next) {
  if (!this.totalAmount) {
    this.totalAmount = this.pricePerTicket * this.quantity;
  }
  this.price = this.pricePerTicket;
  this.buyerName = this.buyerName || this.customerName;
  this.buyerEmail = this.buyerEmail || this.customerEmail;
  if (!this.bookingReference) {
    this.bookingReference = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  next();
});

export default mongoose.model('Ticket', TicketSchema);
