import mongoose from 'mongoose';

const priceLogSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, index: true },
    timestamp: { type: Date, default: Date.now },
    features: {
      capacity: { type: Number },
      ticketsSold: { type: Number },
      basePrice: { type: Number },
      daysUntilEvent: { type: Number },
      eventPopularity: { type: Number },
      occupancyRate: { type: Number },
    },
    predictedPrice: { type: Number, required: true },
    shadowPrice: { type: Number },
    actualPrice: { type: Number, required: true },
    isSale: { type: Boolean, default: false, index: true },
    isAudit: { type: Boolean, default: false, index: true },
    auditHash: { type: String, unique: true, sparse: true },
    behavioralSignature: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

priceLogSchema.pre('save', function (next) {
  // Audit logs are permanent; standard logs expire
  if (this.isAudit) {
    this.expiresAt = undefined;
  } else {
    const days = this.isSale ? 90 : 30;
    this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  next();
});

priceLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PriceLog = mongoose.models.PriceLog || mongoose.model('PriceLog', priceLogSchema);
export default PriceLog;
