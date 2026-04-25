const axios = require('axios');

// ── Unified Monolith Configuration ──
const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';
const AUTH_URL = `${BASE_URL}/auth/signup`;
const SIM_URL = `${BASE_URL}/ai/simulator/neo4j`;

async function main() {
  try {
    console.log('🚀 Starting Monolith Integration Test...');
    console.log(`🔗 API Base: ${BASE_URL}`);

    // Default payloads
    const signupPayload = {
      name: 'Test Citizen',
      email: 'test-citizen@fanfever.local',
      password: 'password123',
      role: 'organizer'
    };

    const simPayload = {
      eventName: 'Demo Concert',
      eventId: 'demo-' + Date.now(),
      categories: [
        { name: 'VIP', seats: 100, bookedSeats: ['A1', 'A2'], blockedSeats: ['A3'] },
        { name: 'Standard', seats: 500, bookedSeats: [], blockedSeats: [] }
      ],
      layoutType: 'stadium',
      venueMetrics: { exitsCount: 4 },
      eventPopularity: 0.85
    };

    // 🛡️ Global Security Headers for Axios
    const commonHeaders = {
      'User-Agent': 'Mozilla/5.0 (MonolithTester; 1.0)',
      'Accept': 'application/json'
    };

    // 1. Authenticate (Signup or Signin)
    console.log('🛡️  Authenticating...');
    let token = null;
    
    try {
      const su = await axios.post(AUTH_URL, signupPayload, { headers: commonHeaders }).catch(e => e.response);
      
      if (su && su.status === 201 && su.data.token) {
        token = su.data.token;
        console.log('✅ Signup successful.');
      } else {
        const signinUrl = AUTH_URL.replace('/signup', '/login');
        const s = await axios.post(signinUrl, { 
          email: signupPayload.email, 
          password: signupPayload.password 
        }, { headers: commonHeaders });
        
        if (s.data && s.data.token) {
          token = s.data.token;
          console.log('✅ Signin successful.');
        } else {
          console.error('❌ Authentication failed:', s.status, s.data);
          process.exit(2);
        }
      }
    } catch (e) {
      console.error('❌ Auth request failed:', e.message);
      process.exit(2);
    }

    // 2. Test Simulator Endpoint
    console.log('🧪 Testing Neo4j Simulator...');
    const res = await axios.post(SIM_URL, simPayload, {
      headers: { ...commonHeaders, 'Authorization': `Bearer ${token}` }
    });

    console.log('📡 Response Status:', res.status);

    if (res.status === 200 && res.data.stored) {
      console.log('✅ Simulation stored in Neo4j graph.');
      console.log('📊 Synthetic Scores:', JSON.stringify(res.data.scores));
      console.log('🎊 MONOLITH INTEGRATION TEST PASSED!');
      process.exit(0);
    } else {
      console.error('❌ Simulator test failed:', res.data);
      process.exit(3);
    }

  } catch (err) {
    console.error('💥 Critical script error:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();
