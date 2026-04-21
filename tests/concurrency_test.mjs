import axios from 'axios';
import crypto from 'crypto';

const GATEWAY_URL = 'http://localhost:3001/api';

async function runConcurrencyTest() {
  console.log('--- 🛡️ System Robustness Test: Race Condition & Inventory Integrity 🛡️ ---');
  
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const testEmail = `stress_${randomSuffix}@test.com`;
  
  try {
    // 1. Setup: Create a temporary test user
    console.log(`[Step 1] Registering test user: ${testEmail}`);
    const regRes = await axios.post(`${GATEWAY_URL}/auth/signup`, {
      name: 'Stress Tester',
      email: testEmail,
      password: 'password123',
      role: 'user'
    });
    const token = regRes.data.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Setup: Find an event with tickets
    console.log('[Step 2] Finding test event...');
    const eventsRes = await axios.get(`${GATEWAY_URL}/events`);
    const event = eventsRes.data.find(e => {
        const cat = e.ticketCategories?.[0];
        return cat && cat.availableSeats > 0;
    }) || eventsRes.data[0];

    if (!event) throw new Error('No events available for testing.');
    
    const categoryName = event.ticketCategories?.[0]?.name || 'standard';
    const initialSeats = (event.ticketCategories?.find(c => c.name === categoryName)?.availableSeats) || 10;
    
    console.log(`🎯 Targeting Event: ${event.name}`);
    console.log(`🎯 Category: ${categoryName} (Initial Seats: ${initialSeats})`);

    // 3. The Blitz: Fire 25 concurrent requests to buy 1 ticket each
    const requestCount = 25;
    console.log(`\n[Step 3] Launching Blitz: ${requestCount} simultaneous purchase attempts...`);
    
    const startTime = Date.now();
    const requests = Array.from({ length: requestCount }).map(() => 
      axios.post(`${GATEWAY_URL}/tickets`, {
        eventId: event._id,
        categoryName: categoryName,
        quantity: 1,
        customerName: 'Concurrency Test',
        customerEmail: testEmail
      }, config).catch(e => ({ error: true, status: e.response?.status, data: e.response?.data }))
    );

    const results = await Promise.all(requests);
    const duration = Date.now() - startTime;

    // 4. Analysis
    const successes = results.filter(r => !r.error && r.status === 201).length;
    const failures = results.filter(r => r.error).length;
    const soldOuts = results.filter(r => r.error && r.status === 400 && r.data?.error?.includes('sold out')).length;

    console.log(`\n--- 📊 Results (Duration: ${duration}ms) ---`);
    console.log(`✅ Successful Purchases: ${successes}`);
    console.log(`❌ Failed Requests: ${failures}`);
    console.log(`🚫 "Sold Out" Errors caught: ${soldOuts}`);

    // 5. Final Inventory Check
    console.log('\n[Step 4] Verifying Final Inventory Integrity...');
    const verifyRes = await axios.get(`${GATEWAY_URL}/events/${event._id}`);
    const finalSeats = (verifyRes.data.ticketCategories?.find(c => c.name === categoryName)?.availableSeats);
    
    console.log(`📉 Expected Seats: ${Math.max(0, initialSeats - successes)}`);
    console.log(`📉 Actual Seats in DB: ${finalSeats}`);

    if (finalSeats < 0) {
      console.error('🛑 CRITICAL FAILURE: OVERBOOKING DETECTED! Inventory is negative.');
    } else if (successes > initialSeats) {
        console.error(`🛑 CRITICAL FAILURE: Sold ${successes} tickets but only ${initialSeats} were available.`);
    } else {
      console.log('💎 INTEGRITY VERIFIED: No overbooking occurred under concurrent load.');
    }

  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

runConcurrencyTest();
