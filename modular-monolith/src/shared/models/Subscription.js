import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan: { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SUBSCRIPTION_PLANS = [
  { id: '7_days', title: 'Weekly Access', durationDays: 7, priceValue: 199 },
  { id: '30_days', title: 'Monthly Plan', durationDays: 30, priceValue: 499 },
  { id: '3_months', title: 'Quarterly Plan', durationDays: 90, priceValue: 1299 },
  { id: '6_months', title: 'Biannual Plan', durationDays: 180, priceValue: 2499 },
  { id: '1_year', title: 'Annual Plan', durationDays: 365, priceValue: 3999 }
];

export const getPlanDuration = (planId) => {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  return plan ? plan.durationDays : 0;
};

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
