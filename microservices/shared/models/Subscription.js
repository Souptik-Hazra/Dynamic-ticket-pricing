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
export const PLAN_DURATIONS_DAYS = {
  '7_days':   7,
  '30_days':  30,
  '3_months': 90,
  '6_months': 180,
  '1_year':   365,
};

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
