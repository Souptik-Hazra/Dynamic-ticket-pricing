const mongoose = require('mongoose');

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
  date: {
    type: Date,
    required: true
  },
  ticketPrice: {
    type: Number,
    required: true,
    min: 0,
    default: 100
  },
  totalCapacity: {
    type: Number,
    required: true,
    min: 1
  },
  availableTickets: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['concert', 'sports', 'theater', 'conference', 'festival', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  image: {
    type: String,
    default: 'https://c8.alamy.com/comp/2CA3WX9/event-word-and-splashs-2CA3WX9.jpg'
  },
  popularity: {
    type: Number,
    default: 5,
    min: 0,
    max: 10
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

// Auto-update status based on current date
eventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  if (this.status !== 'cancelled') {
    const now = new Date();
    const eventDate = new Date(this.date);
    const eventEnd = new Date(eventDate);
    eventEnd.setHours(23, 59, 59, 999);
    
    if (now < eventDate) {
      this.status = 'upcoming';
    } else if (now >= eventDate && now <= eventEnd) {
      this.status = 'ongoing';
    } else {
      this.status = 'completed';
    }
  }
  
  next();
});

// Virtual field for days until event
eventSchema.virtual('daysUntilEvent').get(function() {
  const now = new Date();
  const eventDate = new Date(this.date);
  const diffTime = eventDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Virtual field for occupancy rate
eventSchema.virtual('occupancyRate').get(function() {
  return this.totalCapacity > 0 ? ((this.totalCapacity - this.availableTickets) / this.totalCapacity) : 0;
});

eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);
