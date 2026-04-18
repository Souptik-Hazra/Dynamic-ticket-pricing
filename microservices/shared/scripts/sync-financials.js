import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Event from '../models/Event.js';

// Load env from organizer-service
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../organizer-service/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';

async function sync() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const events = await Event.find({});
    console.log(`Found ${events.length} events to sync.`);

    for (const event of events) {
      console.log(`Syncing event: ${event.name} (${event._id})`);
      
      // Triggering the pre-save hook will recalculate:
      // - baseRevenue (sum of category base prices * sold)
      // - profitAmount (totalRevenue - baseRevenue)
      // - profitPercentage
      // - ticketsSold / capacity / availableTickets
      
      await event.save();
    }

    console.log('Synchronization complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

sync();
