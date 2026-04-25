import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  plan: { type: String, default: 'none' },
  isActive: { type: Boolean, default: false },
  endDate: { type: Date, default: null }
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'organizer', 'admin', 'staff'], default: 'user' },
    city: { type: String, default: '' },
    birthdate: { type: Date, default: null },
    lastPurchaseAt: { type: Date },
    botScore: { type: Number, default: 0 },
    subscription: { type: subscriptionSchema, default: () => ({}) },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
