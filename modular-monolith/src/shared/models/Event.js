import mongoose from 'mongoose';

const ticketCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true },
    price: { type: Number, required: true, min: 0 },
    maxPrice: { type: Number },
    lastCalculatedPrice: { type: Number },
    seats: { type: Number, required: true, min: 1 },
    availableSeats: { type: Number },
    bookedSeats: [{ type: String }],
    blockedSeats: [{ type: String }],
    color: { type: String, default: '' },
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    venue: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    category: {
      type: String,
      enum: ['concert', 'sports', 'theater', 'conference', 'festival', 'other'],
      default: 'other',
    },
    image: { type: String, default: '' },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    ticketCategories: [ticketCategorySchema],
    capacity: { type: Number, default: 0 },
    ticketsSold: { type: Number, default: 0 },
    availableTickets: { type: Number, default: 0 },
    basePrice: { type: Number, default: 0 },
    currentPrice: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    baseRevenue: { type: Number, default: 0 },
    profitAmount: { type: Number, default: 0 },
    profitPercentage: { type: Number, default: 0 },
    commissionCollected: { type: Number, default: 0 },
    eventPopularity: { type: Number, min: 0, max: 1, default: 0.5 },
    venueTier: { type: Number, enum: [1, 2, 3], default: 2 },
    artistTier: { type: Number, min: 0, max: 5, default: 0 },
    isHoliday: { type: Boolean, default: false },
    venueLayoutType: {
      type: String,
      enum: ['none', 'stadium', 'theater', 'arena', 'rectangle', 'festival', 'premium_concert'],
      default: 'none',
    },
    stagePosition: {
      type: String,
      enum: ['top', 'bottom', 'left', 'right', 'center'],
      default: 'bottom',
    },
    seatMap: [{
      seatId: { type: String, required: true },
      categoryName: { type: String, required: true }
    }],
    venueMetrics: {
      exitsCount: { type: Number, default: 4 },
      aisleWidth: { type: String, enum: ['narrow', 'standard', 'wide'], default: 'standard' },
      securitySpeed: { type: String, enum: ['slow', 'normal', 'fast'], default: 'normal' }
    },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

eventSchema.index({ status: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ startDate: 1 });

eventSchema.pre('save', async function () {
  if (this.ticketCategories && this.ticketCategories.length > 0) {
    this.ticketCategories.forEach((cat) => {
      if (cat.availableSeats == null) cat.availableSeats = cat.seats || 0;
      if (!cat.maxPrice) cat.maxPrice = (cat.price || 0) * 2;
    });

    const categoriesWithPrice = this.ticketCategories.filter(c => typeof c.price === 'number' && !isNaN(c.price));
    this.capacity = this.ticketCategories.reduce((s, c) => s + (Number(c.seats) || 0), 0);
    this.availableTickets = this.ticketCategories.reduce((s, c) => s + (Number(c.availableSeats) || 0), 0);
    this.ticketsSold = Math.max(0, this.capacity - this.availableTickets);
    
    if (categoriesWithPrice.length > 0) {
      this.basePrice = Math.min(...categoriesWithPrice.map((c) => c.price));
    } else {
      this.basePrice = 0;
    }
    
    this.currentPrice = this.currentPrice || this.basePrice || 0;
    this.baseRevenue = this.ticketCategories.reduce((sum, cat) => {
      const soldInCategory = Math.max(0, (cat.seats || 0) - (cat.availableSeats || 0));
      return sum + (soldInCategory * (cat.price || 0));
    }, 0);

    this.profitAmount = Math.max(0, (this.totalRevenue || 0) - this.baseRevenue);
    this.profitPercentage = this.baseRevenue > 0 ? (this.profitAmount / this.baseRevenue) * 100 : 0;
  } else {
    this.capacity = 0;
    this.availableTickets = 0;
    this.ticketsSold = 0;
    this.basePrice = 0;
  }
});

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
export default Event;
