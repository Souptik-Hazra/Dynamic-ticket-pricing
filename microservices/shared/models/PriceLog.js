import mongoose from 'mongoose';

const priceLogSchema = new mongoose.Schema(
  {
    eventId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, index: true },
    timestamp:  { type: Date, default: Date.now },
    
    // Feature Snapshot (What the model saw)
    features: {
      capacity:         { type: Number },
      ticketsSold:      { type: Number },
      basePrice:        { type: Number },
      daysUntilEvent:   { type: Number },
      eventPopularity:  { type: Number },
      occupancyRate:    { type: Number },
    },

    // Model Outputs
    predictedPrice: { type: Number, required: true },
    shadowPrice:    { type: Number }, // Experimental model result
    actualPrice:    { type: Number, required: true }, // After smoothing/max caps
    
    // Feedback Loop
    isSale: { type: Boolean, default: false, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date }, // Tiered TTL field (TTL index defined below)
  },
  { timestamps: true }
);

// ── Tiered Retention Policy ────────────────────────────────────────────────
// Shadow logs (no sale) = 30 days
// Sale logs = 90 days
priceLogSchema.pre('save', function(next) {
    const days = this.isSale ? 90 : 30;
    this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    next();
});

// TTL index to automatically prune logs based on the calculated expiresAt
priceLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PriceLog = mongoose.models.PriceLog || mongoose.model('PriceLog', priceLogSchema);
export default PriceLog;
