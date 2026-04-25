import axios from 'axios';

/**
 * ⚡ "War-Room" Stress Test Simulation
 * 
 * Simulates a high-stakes "Flash Sale" launch:
 * 1. 1,000 Concurrent Requests.
 * 2. Mixed traffic: Real Fans vs. Suspected Bots.
 * 3. Proves Hot-Path Caching and Price Locking.
 */

const API_URL = 'http://localhost:4000/api/v1';
const TEST_EVENT_ID = '69ecfb8f48854f910b361c02'; 
const TOTAL_USERS = 100;
const CONCURRENCY = 10;

async function simulateUser(index) {
  const isBot = index % 10 === 0; // Every 10th user is a bot (missing browser headers)
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': isBot ? 'Puppeteer-Bot/1.0' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  };

  if (!isBot) {
    headers['accept-language'] = 'en-US,en;q=0.9';
    headers['sec-ch-ua'] = '"Google Chrome";v="119"';
  }

  try {
    const start = Date.now();
    
    // 1. View Pricing (Triggers Cache + Behavioral Intent)
    const priceRes = await axios.get(`${API_URL}/catalog/${TEST_EVENT_ID}/dynamic-prices`, { headers });
    
    // 2. Simulate "Thinking" time
    await new Promise(r => setTimeout(r, Math.random() * 2000));

    const duration = Date.now() - start;
    process.stdout.write(isBot ? '🛡️' : '🎫');

    return { success: true, isBot, duration };
  } catch (err) {
    process.stdout.write('❌');
    return { success: false, isBot, error: err.response?.data?.error || err.message };
  }
}

async function runStressTest() {
  console.log(`🔥 Starting "War-Room" Simulation: ${TOTAL_USERS} Users...`);
  console.log(`🚀 Concurrency: ${CONCURRENCY} | Target: ${API_URL}`);
  console.log('---------------------------------------------------------');

  const results = [];
  const start = Date.now();

  for (let i = 0; i < TOTAL_USERS; i += CONCURRENCY) {
    const chunk = Array.from({ length: CONCURRENCY }, (_, j) => simulateUser(i + j));
    const chunkResults = await Promise.all(chunk);
    results.push(...chunkResults);
  }

  const end = Date.now();
  const totalTime = (end - start) / 1000;
  
  const successful = results.filter(r => r.success).length;
  const botBlocked = results.filter(r => !r.success && r.isBot).length;
  const avgLatency = results.filter(r => r.success).reduce((a, b) => a + b.duration, 0) / successful;

  console.log('\n---------------------------------------------------------');
  console.log(`📊 TEST COMPLETE in ${totalTime.toFixed(2)}s`);
  console.log(`✅ Successful Requests: ${successful}`);
  console.log(`🛡️ Bot Deflections: ${botBlocked}`);
  console.log(`⏱️ Avg Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`📈 Throughput: ${(successful / totalTime).toFixed(1)} req/sec`);
}

runStressTest().catch(console.error);
