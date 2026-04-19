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
  },
  { timestamps: true }
);

// TTL index to automatically prune logs after 90 days to save DB space
priceLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const PriceLog = mongoose.models.PriceLog || mongoose.model('PriceLog', priceLogSchema);
export default PriceLog;
