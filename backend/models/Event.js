const mongoose = require('mongoose');

const ticketCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['standard', 'vip', 'premium', 'balcony', 'economy']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  maxPrice: {
    type: Number,
    required: true,
    min: 0,
    default: function() { return this.price * 2; } // Default max is 2x base price
  },
  seats: {
    type: Number,
    required: true,
    min: 0
  },
  availableSeats: {
    type: Number,
    required: true,
    min: 0,
    default: function() { return this.seats; }
  }
});

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  venue: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: false
  },
  ticketCategories: {
    type: [ticketCategorySchema],
    default: []
  },
  capacity: {
    type: Number,
    default: function() {
      return this.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
    }
  },
  totalCapacity: {
    type: Number,
    default: function() {
      return this.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
    }
  },
  availableTickets: {
    type: Number,
    default: function() {
      return this.ticketCategories.reduce((sum, cat) => sum + cat.availableSeats, 0);
    }
  },
  popularity: {
    type: Number,
    default: 5,
    min: 0,
    max: 10
  },
  eventPopularity: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  historicalDemand: {
    type: Number,
    default: 0.5,
    min: 0,
    max: 1
  },
  category: {
    type: String,
    enum: ['concert', 'sports', 'theater', 'conference', 'festival', 'other'],
    default: 'other'
  },
  basePrice: {
    type: Number,
    default: function() {
      if (this.ticketCategories && this.ticketCategories.length > 0) {
        return Math.min(...this.ticketCategories.map(cat => cat.price));
      }
      return 0;
    },
    min: 0
  },
  ticketPrice: {
    type: Number,
    default: function() {
      if (this.ticketCategories && this.ticketCategories.length > 0) {
        return Math.min(...this.ticketCategories.map(cat => cat.price));
      }
      return 0;
    },
    min: 0
  },
  currentPrice: {
    type: Number,
    default: function() {
      if (this.ticketCategories && this.ticketCategories.length > 0) {
        return Math.min(...this.ticketCategories.map(cat => cat.price));
      }
      return 0;
    }
  },
  image: {
    type: String,
    default: 'https://c8.alamy.com/comp/2CA3WX9/event-word-and-splashs-2CA3WX9.jpg'
  },
  ticketsSold: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  hourOfDay: {
    type: Number,
    min: 0,
    max: 23,
    default: 12  // Default to noon
  },
  isHoliday: {
    type: Boolean,
    default: false
  },
  venueTier: {
    type: Number,
    enum: [1, 2, 3],  // 1=Small, 2=Medium, 3=Large/Stadium
    default: 2
  },
  artistTier: {
    type: Number,
    enum: [0, 1, 2, 3, 4, 5],  // 0=No Artist/N/A, 1=Local, 5=International Superstar
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Auto-update status based on current date before saving
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-set status based on dates (skip if cancelled)
  if (this.status !== 'cancelled') {
    const now = new Date();
    const start = new Date(this.startDate);
    // Treat endDate as end-of-day (23:59:59) so same-day events stay "ongoing" all day
    const end = this.endDate ? new Date(this.endDate) : new Date(start);
    end.setHours(23, 59, 59, 999);
    
    if (now < start) {
      this.status = 'upcoming';
    } else if (now >= start && now <= end) {
      this.status = 'ongoing';
    } else {
      this.status = 'completed';
    }
  }
  
  next();
});

// Static method to bulk-update event statuses based on current date
eventSchema.statics.updateEventStatuses = async function() {
  const now = new Date();
  
  // Build end-of-today for same-day comparison
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  
  // 1. Completed: endDate is before today (not cancelled)
  await this.updateMany(
    {
      status: { $in: ['upcoming', 'ongoing'] },
      endDate: { $ne: null, $lt: startOfToday }
    },
    { $set: { status: 'completed', updatedAt: now } }
  );
  
  // Also complete events with no endDate where startDate is before today  
  await this.updateMany(
    {
      status: { $in: ['upcoming', 'ongoing'] },
      endDate: null,
      startDate: { $lt: startOfToday }
    },
    { $set: { status: 'completed', updatedAt: now } }
  );
  
  // 2. Ongoing: startDate <= now AND (endDate >= today OR endDate is today)
  await this.updateMany(
    {
      status: { $in: ['upcoming'] },
      startDate: { $lte: endOfToday },
      $or: [
        { endDate: { $gte: startOfToday } },
        { endDate: null, startDate: { $gte: startOfToday } }
      ]
    },
    { $set: { status: 'ongoing', updatedAt: now } }
  );
};

// Virtual field for days until event
eventSchema.virtual('daysUntilEvent').get(function() {
  const now = new Date();
  const eventDate = new Date(this.startDate);
  const diffTime = eventDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual field for event duration in days
eventSchema.virtual('eventDuration').get(function() {
  if (!this.startDate || !this.endDate) return 1;
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const diffTime = end - start;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
});

// Virtual field for occupancy rate
eventSchema.virtual('occupancyRate').get(function() {
  return this.capacity > 0 ? (this.ticketsSold / this.capacity) : 0;
});

eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);
