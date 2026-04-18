import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  date: { type: Date, required: true },
  location: String,
  organizerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Organizer' },
  ticketsAvailable: { type: Number, default: 0 },
  price: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Event', EventSchema);
