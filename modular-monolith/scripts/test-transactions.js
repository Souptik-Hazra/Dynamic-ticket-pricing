import mongoose from 'mongoose';
import crypto from 'crypto';

import { connectMongoDB } from '../src/shared/db/index.js';
import ticketService from '../src/modules/tickets/service/ticket.service.js';
import catalogRepo from '../src/modules/catalog/repository/catalog.repo.js';
import ticketRepo from '../src/modules/tickets/repository/ticket.repo.js';

async function testTransactionAtomicity() {
  console.log('🛡️ Testing Database Transaction Atomicity...');
  
  await connectMongoDB();

  // 1. Find a test event
  const event = await catalogRepo.findOneAndUpdate({}, { $set: { availableTickets: 10, ticketsSold: 0 } });
  if (!event) {
    console.error('❌ No events found to test with.');
    process.exit(1);
  }
  
  const initialAvailable = event.availableTickets;
  console.log(`📊 Initial Inventory: ${initialAvailable}`);

  // 2. Monkey-patch ticketRepo.create to FAIL
  const originalCreate = ticketRepo.create;
  ticketRepo.create = async () => {
    throw new Error('SIMULATED_DB_FAILURE_DURING_TICKET_CREATION');
  };

  try {
    console.log('⏳ Attempting purchase (should fail and rollback)...');
    
    // Generate valid proof for difficulty 1
    const challenge = 'valid';
    const proof = crypto.createHash('sha256').update(challenge + '0').digest('hex');

    await ticketService.purchaseTickets('test-user-id', {
      eventId: event._id,
      quantity: 1,
      pricePerTicket: 100,
      humanityProof: challenge,
      temporalProof: proof,
      difficulty: 1
    }, { name: 'Test User', email: 'test@example.com' });
  } catch (err) {
    console.log(`✅ Caught expected error: ${err.message}`);
  }


  // 3. Check inventory again
  const refreshedEvent = await catalogRepo.findById(event._id);
  console.log(`📊 Final Inventory: ${refreshedEvent.availableTickets}`);

  // Restore original
  ticketRepo.create = originalCreate;

  if (refreshedEvent.availableTickets === initialAvailable) {
    console.log('🎉 TRANSACTION SUCCESSFUL: Inventory was rolled back!');
  } else {
    console.error('❌ TRANSACTION FAILED: Inventory was NOT rolled back!');
    process.exit(1);
  }

  await mongoose.disconnect();
}

testTransactionAtomicity().catch(async err => {
  console.error('💥 Test Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});


