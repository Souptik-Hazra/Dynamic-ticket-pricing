import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const ORGANIZER_SERVICE_URL = process.env.ORGANIZER_SERVICE_URL || 'http://localhost:4013';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';

function solveVDF(challenge, difficulty = 2000) {
  let result = challenge;
  for (let i = 0; i < difficulty; i++) {
    result = crypto.createHash('sha256').update(result + i).digest('hex');
  }
  return result;
}

async function testPriceTamper() {
  console.log('--- 🧪 Price Tamper Test: Expecting PRICE_MISMATCH ---');
  try {
    const eventsRes = await axios.get(`${ORGANIZER_SERVICE_URL}/api/events`);
    if (!eventsRes.data || eventsRes.data.length === 0) {
      console.error('❌ No events available. Create an event first.');
      process.exit(2);
    }

    const event = eventsRes.data[0];
    const eventId = event._id;
    const category = (event.ticketCategories && event.ticketCategories[0]) || null;
    if (!category) {
      console.error('❌ No ticket categories found for the event.');
      process.exit(2);
    }

    console.log(`📡 Testing Event ${eventId}, Category ${category.name}`);

    // Fetch dynamic prices (best-effort)
    const priceRes = await axios.get(`${ORGANIZER_SERVICE_URL}/api/events/${eventId}/dynamic-prices?cognitive_score=1.0`);
    const serverPrice = priceRes.data.prices?.[category.name] || category.price;
    console.log('🔢 Server reported price:', serverPrice);

    // Tamper: attempt to buy at a dramatically different price to trigger mismatch
    const tamperedPrice = Math.round((serverPrice + 1000) * 100) / 100;
    console.log('🎯 Tampered client price:', tamperedPrice);

    // Ensure we have a valid JWT by creating/signing in a temporary test user
    const testEmail = `test+tamper_${Date.now()}@example.com`;
    const testPassword = 'Password123!';
    let token;
    try {
      const signup = await axios.post(`${AUTH_SERVICE_URL}/api/auth/signup`, { name: 'Tamper Test', email: testEmail, password: testPassword });
      token = signup.data.token;
    } catch (signupErr) {
      // If signup fails (e.g., duplicate), try login
      try {
        const login = await axios.post(`${AUTH_SERVICE_URL}/api/auth/signin`, { email: testEmail, password: testPassword });
        token = login.data.token;
      } catch (loginErr) {
        console.warn('Signup/login for test user failed:', signupErr.message);
      }
    }

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Obtain session nonce from organizer (one-time-use) to satisfy security checks
    let sessionId = undefined;
    try {
      const nonceRes = await axios.get(`${ORGANIZER_SERVICE_URL}/api/security/nonce`);
      sessionId = nonceRes.data.sessionId;
    } catch (nonceErr) {
      console.warn('Could not obtain session nonce:', nonceErr.message);
    }

    // Solve VDF for the test
    const humanityProof = 'test-proof';
    const temporalProof = solveVDF(humanityProof);

    try {
      const res = await axios.post(`${ORGANIZER_SERVICE_URL}/api/tickets`, {
        eventId,
        categoryId: category._id,
        categoryName: category.name,
        quantity: 1,
        customerName: 'Tamper Buyer',
        customerEmail: testEmail,
        pricePerTicket: tamperedPrice,
        cognitive_score: 1.0,
        sessionId,
        humanityProof,
        temporalProof
      }, { headers, validateStatus: () => true });

      if (res.status === 409 && res.data && res.data.error === 'PRICE_MISMATCH') {
        console.log('✅ Test passed: server rejected tampered price with PRICE_MISMATCH');
        process.exit(0);
      }

      console.error('❌ Test failed: expected 409 PRICE_MISMATCH but got', res.status, res.data);
      process.exit(3);
    } catch (postErr) {
      console.error('❌ Request failed:', postErr.message);
      process.exit(3);
    }
  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

testPriceTamper();
