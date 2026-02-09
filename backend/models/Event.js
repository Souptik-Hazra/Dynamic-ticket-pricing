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
    default: 'https://via.placeholder.com/400x250'
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
    enum: [1, 2, 3, 4, 5],  // 1=Local, 5=International Superstar
    default: 3
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

// Update the updatedAt field before saving
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

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
