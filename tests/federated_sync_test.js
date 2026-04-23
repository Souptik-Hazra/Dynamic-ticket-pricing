import axios from 'axios';

const ORGANIZER_SERVICE_URL = 'http://localhost:4013';
const AUTH_SERVICE_URL = 'http://localhost:4001'; // Needed to get a JWT token if we enforce auth

// Helper to generate fake neural weights
function generateFakeWeights(isAnomaly = false) {
  const shapes = [
    { name: 'dense_1/kernel', shape: [16, 16] },
    { name: 'dense_1/bias', shape: [16] }
  ];

  return shapes.map(layer => {
    const size = layer.shape.reduce((a, b) => a * b, 1);
    const data = [];
    for (let i = 0; i < size; i++) {
      // Normal weight is roughly between -1 and 1
      // Anomaly bot weight is extreme (e.g. 50)
      let val = isAnomaly ? (Math.random() > 0.5 ? 50 : -50) : (Math.random() * 2 - 1);
      data.push(val);
    }
    return { name: layer.name, shape: layer.shape, data };
  });
}

async function runFederatedTest() {
  console.log("🚀 Starting Federated Sync Integration Test...");

  // 1. Simulate 3 Good Clients
  for (let i = 1; i <= 3; i++) {
    const payload = {
      weights: generateFakeWeights(false),
      nodeId: `good-client-${i}`,
      reputation: { accountAgeDays: 200, purchaseCount: 5 } // High reputation (weight ~ 1.0)
    };
    
    try {
      const res = await axios.post(`${ORGANIZER_SERVICE_URL}/api/security/federated-sync`, payload);
      console.log(`✅ Good Client ${i} Sync:`, res.data);
    } catch (err) {
      console.error(`❌ Good Client ${i} Sync failed:`, err.response?.data || err.message);
    }
  }

  // 2. Simulate 1 Bot/Sybil Attacker (Anomaly weights)
  const botPayload = {
    weights: generateFakeWeights(true),
    nodeId: `bot-attacker-1`,
    reputation: { accountAgeDays: 0, purchaseCount: 0 } // Low reputation
  };
  
  try {
    const res = await axios.post(`${ORGANIZER_SERVICE_URL}/api/security/federated-sync`, botPayload);
    console.log(`❌ Bot Sync succeeded unexpectedly:`, res.data);
  } catch (err) {
    console.log(`🛡️ Bot Sync correctly rejected (Status ${err.response?.status}):`, err.response?.data);
  }

  // 3. Trigger Aggregation
  console.log("🔄 Triggering Aggregation Round...");
  
  // Note: We need a JWT token for /api/federated/aggregate because it has jwtMiddleware.
  // For testing without the auth service running complexly, we can either:
  // A) Login to get a token
  // B) Just remove jwtMiddleware from that endpoint temporarily, or assume the user has a test token.
  // Actually, I'll perform a quick mock login to get a token if needed, or we can just try it.
  
  // Let's create a dummy user and login to get JWT
  let token = "";
  try {
    const signupRes = await axios.post(`${AUTH_SERVICE_URL}/api/auth/register`, {
      name: "Fed Admin",
      email: `fedadmin-${Date.now()}@test.com`,
      password: "password123",
      role: "admin"
    });
    token = signupRes.data.token;
  } catch (err) {
    // If user exists, try login
    try {
      const loginRes = await axios.post(`${AUTH_SERVICE_URL}/api/auth/login`, {
        email: "fedadmin@test.com",
        password: "password123"
      });
      token = loginRes.data.token;
    } catch (e) {
      console.log("Could not obtain JWT token. Attempting aggregation without it (might fail if jwtMiddleware is strict).");
    }
  }

  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const aggRes = await axios.post(`${ORGANIZER_SERVICE_URL}/api/federated/aggregate`, {}, { headers });
    console.log("✅ Aggregation Successful! Round Log:");
    console.log(JSON.stringify(aggRes.data.roundLog, null, 2));
    console.log("New Model Version:", aggRes.data.modelVersion);
  } catch (err) {
    console.error("❌ Aggregation failed:", err.response?.data || err.message);
  }
}

runFederatedTest();
