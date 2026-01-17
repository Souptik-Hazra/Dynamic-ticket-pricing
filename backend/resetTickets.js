const mongoose = require('mongoose');

async function resetTickets() {
  try {
    await mongoose.connect('mongodb://localhost:27017/dynamic-ticket-pricing');
    console.log('Connected to MongoDB');

    // Delete all tickets
    const ticketResult = await mongoose.connection.db.collection('tickets').deleteMany({});
    console.log('Deleted tickets:', ticketResult.deletedCount);

    // Reset event inventory
    const events = await mongoose.connection.db.collection('events').find({}).toArray();
    
    for (const event of events) {
      if (event.ticketCategories) {
        const updatedCategories = event.ticketCategories.map(cat => ({
          ...cat,
          availableSeats: cat.seats
        }));
        
        await mongoose.connection.db.collection('events').updateOne(
          { _id: event._id },
          { 
            $set: { 
              ticketCategories: updatedCategories,
              ticketsSold: 0,
              availableTickets: updatedCategories.reduce((sum, c) => sum + c.seats, 0),
              totalRevenue: 0
            }
          }
        );
      }
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
