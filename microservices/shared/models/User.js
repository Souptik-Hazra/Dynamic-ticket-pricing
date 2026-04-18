import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  plan:     { type: String, default: 'none' },
  isActive: { type: Boolean, default: false },
  endDate:  { type: Date, default: null }
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // excluded by default
    role:     { type: String, enum: ['user', 'organizer', 'admin'], default: 'user' },

    // Extended profile
    city:      { type: String, default: '' },
    birthdate: { type: Date, default: null },

    // Subscription snapshot (denormalised for fast reads)
    subscription: { type: subscriptionSchema, default: () => ({}) },
  },
  { timestamps: true } // adds createdAt, updatedAt automatically
);

// Prevent duplicate model registration when services share the process
const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
