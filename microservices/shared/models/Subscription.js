import mongoose from 'mongoose';

/* ── Subscription Schema ─────────────────────────────────────────────────── */
// One subscription document per user (upserted on upgrade).
// After an upgrade the user.subscription snapshot in the User document is
// also updated so the auth /me endpoint reflects the latest plan.
const subscriptionSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    plan:      { type: String, required: true },
    startDate: { type: Date, default: Date.now },
    endDate:   { type: Date, required: true },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* ── Valid plans (shared constant) ──────────────────────────────────────── */
/* ── Valid plans (shared source of truth) ─────────────────────────────────── */
export const SUBSCRIPTION_PLANS = [
  {
    id: '7_days',
    title: 'Weekly Access',
    duration: '7 Days',
    durationDays: 7,
    price: '₹199',
    priceValue: 199,
    features: ['Basic Support', 'Limited Analytics']
  },
  {
    id: '30_days',
    title: 'Monthly Plan',
    duration: '30 Days',
    durationDays: 30,
    price: '₹499',
    priceValue: 499,
    features: ['Priority Support', 'Full Analytics', '10% Discount']
  },
  {
    id: '3_months',
    title: 'Quarterly Plan',
    duration: '3 Months',
    durationDays: 90,
    price: '₹1,299',
    priceValue: 1299,
    features: ['Priority Support', 'Full Analytics', '15% Discount']
  },
  {
    id: '6_months',
    title: 'Biannual Plan',
    duration: '6 Months',
    durationDays: 180,
    price: '₹2,499',
    priceValue: 2499,
    features: ['Priority Support', 'Full Analytics', '20% Discount']
  },
  {
    id: '1_year',
    title: 'Annual Plan',
    duration: '1 Year',
    durationDays: 365,
    price: '₹3,999',
    priceValue: 3999,
    features: ['VIP Support', 'All Features', '25% Discount']
  }
];

// Helper to get duration by plan ID
export const getPlanDuration = (planId) => {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  return plan ? plan.durationDays : 0;
};

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
