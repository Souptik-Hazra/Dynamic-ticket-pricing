import mongoose from 'mongoose';

const ticketCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, lowercase: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  maxPrice: { type: Number },
  seats: { type: Number, required: true, min: 0 },
  availableSeats: { type: Number }
}, { _id: true });

// Pre-save: if availableSeats not set, default to seats
ticketCategorySchema.pre('save', function(next) {
  if (this.availableSeats === undefined) this.availableSeats = this.seats;
  if (!this.maxPrice) this.maxPrice = this.price * 2;
  next();
});

const EventSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true },
  description:      { type: String, default: '' },
  venue:            { type: String, required: true, trim: true },
  startDate:        { type: Date, required: true },
  endDate:          { type: Date },
  category:         { type: String, enum: ['concert', 'sports', 'theater', 'conference', 'festival', 'other'], default: 'other' },
  image:            { type: String, default: '' },
  status:           { type: String, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming' },

  // Ticket structure
  ticketCategories: [ticketCategorySchema],

  // Legacy flat fields (kept for backwards compatibility)
  capacity:         { type: Number, default: 0 },
  ticketsSold:      { type: Number, default: 0 },
  basePrice:        { type: Number, default: 0 },
  currentPrice:     { type: Number, default: 0 },
  availableTickets: { type: Number, default: 0 },

  // Revenue tracking
  baseRevenue:      { type: Number, default: 0 },
  totalRevenue:     { type: Number, default: 0 },

  // ML / Dynamic pricing inputs
  eventPopularity:  { type: Number, min: 0, max: 1, default: 0.5 },
  venueTier:        { type: Number, enum: [1, 2, 3], default: 2 },
  artistTier:       { type: Number, min: 0, max: 5, default: 0 },
  isHoliday:        { type: Boolean, default: false },

  organizerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Organizer' },
  createdAt:        { type: Date, default: Date.now }
});

// Virtual: total capacity from ticketCategories
EventSchema.virtual('totalCapacity').get(function() {
  if (this.ticketCategories && this.ticketCategories.length > 0) {
    return this.ticketCategories.reduce((sum, c) => sum + c.seats, 0);
  }
  return this.capacity;
});

// Sync capacity/availableTickets from ticketCategories before save
EventSchema.pre('save', function(next) {
  if (this.ticketCategories && this.ticketCategories.length > 0) {
    this.capacity = this.ticketCategories.reduce((sum, c) => sum + c.seats, 0);
    this.availableTickets = this.ticketCategories.reduce((sum, c) => sum + (c.availableSeats ?? c.seats), 0);
    this.ticketsSold = this.capacity - this.availableTickets;
    this.basePrice = Math.min(...this.ticketCategories.map(c => c.price));
  }
  next();
});

export default mongoose.model('Event', EventSchema);
