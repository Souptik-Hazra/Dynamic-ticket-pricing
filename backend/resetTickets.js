const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function resetTickets() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dynamic-ticket-pricing';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Delete all tickets
    const ticketResult = await mongoose.connection.db.collection('tickets').deleteMany({});
    console.log('Deleted tickets:', ticketResult.deletedCount);

    // Reset event inventory
    const events = await mongoose.connection.db.collection('events').find({}).toArray();
    
    for (const event of events) {
      await mongoose.connection.db.collection('events').updateOne(
        { _id: event._id },
        { 
          $set: { 
            availableTickets: event.totalCapacity || 0,
            ticketsSold: 0,
            totalRevenue: 0
          }
        }
      );
    }
    
    console.log('Reset', events.length, 'events');
    console.log('✅ All ticket data cleared, user data preserved');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetTickets();
