const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String
  },
  customerEmail: {
    type: String
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  categoryName: {
    type: String,
    enum: ['standard', 'vip', 'premium', 'balcony', 'economy'],
    default: 'standard'
  },
  ticketType: {
    type: String,
    enum: ['standard', 'vip', 'premium', 'early-bird', 'last-minute', 'balcony', 'economy'],
    default: 'standard'
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'refunded', 'pending'],
    default: 'confirmed'
  },
  bookingReference: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Generate booking reference before saving
ticketSchema.pre('save', function(next) {
  if (!this.bookingReference) {
    this.bookingReference = 'TKT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
