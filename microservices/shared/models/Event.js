import mongoose from 'mongoose';

/* ── Ticket Category Sub-document ─────────────────────────────────────────── */
const ticketCategorySchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true, lowercase: true },
    price:          { type: Number, required: true, min: 0 },
    maxPrice:       { type: Number },       // ceiling for dynamic pricing
    seats:          { type: Number, required: true, min: 1 },
    availableSeats: { type: Number },       // set to `seats` on creation
  },
  { _id: true }
);

/* ── Event Schema ─────────────────────────────────────────────────────────── */
const eventSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    venue:       { type: String, required: true, trim: true },
    startDate:   { type: Date, required: true },
    endDate:     { type: Date },
    category:    {
      type: String,
      enum: ['concert', 'sports', 'theater', 'conference', 'festival', 'other'],
      default: 'other',
    },
    image:  { type: String, default: '' },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },

    ticketCategories: [ticketCategorySchema],

    // ── Denormalised / derived fields (synced by pre-save hook) ──
    capacity:         { type: Number, default: 0 },
    ticketsSold:      { type: Number, default: 0 },
    availableTickets: { type: Number, default: 0 },
    basePrice:        { type: Number, default: 0 }, // lowest category price
    currentPrice:     { type: Number, default: 0 },
    totalRevenue:     { type: Number, default: 0 }, // actual accumulated revenue
    baseRevenue:      { type: Number, default: 0 }, // basePrice * ticketsSold (min expected revenue)
    profitAmount:     { type: Number, default: 0 }, // totalRevenue - baseRevenue
    profitPercentage: { type: Number, default: 0 }, // (profitAmount / baseRevenue) * 100

    // ── ML / Dynamic-pricing inputs ──
    eventPopularity: { type: Number, min: 0, max: 1, default: 0.5 },
    venueTier:       { type: Number, enum: [1, 2, 3], default: 2 },
    artistTier:      { type: Number, min: 0, max: 5, default: 0 },
    isHoliday:       { type: Boolean, default: false },

    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/* ── Pre-save: default availableSeats, maxPrice, sync derived fields ─────── */
eventSchema.pre('save', async function () {
  if (this.ticketCategories && this.ticketCategories.length > 0) {
    // Initialise defaults on new sub-docs
    this.ticketCategories.forEach((cat) => {
      if (cat.availableSeats == null) cat.availableSeats = cat.seats || 0;
      if (!cat.maxPrice) cat.maxPrice = (cat.price || 0) * 2;
    });

    const categoriesWithPrice = this.ticketCategories.filter(c => typeof c.price === 'number' && !isNaN(c.price));
    
    this.capacity         = this.ticketCategories.reduce((s, c) => s + (Number(c.seats) || 0), 0);
    this.availableTickets = this.ticketCategories.reduce((s, c) => s + (Number(c.availableSeats) || 0), 0);
    this.ticketsSold      = Math.max(0, this.capacity - this.availableTickets);
    
    if (categoriesWithPrice.length > 0) {
      this.basePrice = Math.min(...categoriesWithPrice.map((c) => c.price));
    } else {
      this.basePrice = 0;
    }
    
    this.currentPrice     = this.currentPrice || this.basePrice || 0;
    
    // Financial calculations
    // baseRevenue is the sum of (originalPrice * ticketsSoldInCategory) for all categories
    this.baseRevenue = this.ticketCategories.reduce((sum, cat) => {
      const soldInCategory = Math.max(0, (cat.seats || 0) - (cat.availableSeats || 0));
      return sum + (soldInCategory * (cat.price || 0));
    }, 0);

    this.profitAmount     = Math.max(0, (this.totalRevenue || 0) - this.baseRevenue);
    this.profitPercentage = this.baseRevenue > 0 ? (this.profitAmount / this.baseRevenue) * 100 : 0;
  } else {
    // defaults if no categories
    this.capacity = 0;
    this.availableTickets = 0;
    this.ticketsSold = 0;
    this.basePrice = 0;
  }
});

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
export default Event;
