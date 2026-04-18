import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['user', 'organizer', 'admin'], default: 'user' },

  // Profile fields
  city:       { type: String, default: '' },
  birthdate:  { type: Date },

  // Subscription info (denormalized from subscription-service for fast reads)
  subscription: {
    plan:     { type: String, default: 'none' },
    isActive: { type: Boolean, default: false },
    endDate:  { type: Date }
  },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
