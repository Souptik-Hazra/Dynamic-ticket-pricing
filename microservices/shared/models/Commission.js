import mongoose from 'mongoose';

const commissionSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    totalRevenue: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    percentage: { type: Number, default: 20 },
    
    status: { type: String, enum: ['paid', 'pending', 'failed'], default: 'paid' },
    payoutDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Commission = mongoose.models.Commission || mongoose.model('Commission', commissionSchema);
export default Commission;
