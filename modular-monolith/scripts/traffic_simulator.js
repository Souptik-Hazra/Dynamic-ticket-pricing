import axios from 'axios';
import { faker } from '@faker-js/faker';

const API_URL = 'http://localhost:4000/api/v1';

async function simulateBot() {
  const url = 'http://localhost:4000/api/tickets/purchase';
  const headers = { 'User-Agent': 'Puppeteer-Bot-Simulated', 'Accept': 'application/json' };
  
  console.log(`🤖 Simulating bot request to ${url}...`);
  try {
    const res = await axios.post(url, { eventId: 'mock-id' }, { headers, validateStatus: false });
    console.log(`Response Status: ${res.status}`);
    if (res.status === 403) console.log('✅ BotShield correctly blocked the request!');
    else console.log('❌ BotShield failed to block the request.');
  } catch (err) {
    console.error('Error during bot simulation:', err.message);
  }
}

async function stressTest() {
  const TEST_EVENT_ID = '69ecfb8f48854f910b361c02'; 
  const TOTAL_USERS = 100;
  const CONCURRENCY = 10;
  
  console.log(`🔥 Starting "War-Room" Simulation: ${TOTAL_USERS} Users...`);
  
  async function simulateUser(index) {
    const isBot = index % 10 === 0;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': isBot ? 'Puppeteer-Bot/1.0' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    };
    if (!isBot) { headers['accept-language'] = 'en-US,en;q=0.9'; headers['sec-ch-ua'] = '"Google Chrome";v="119"'; }
    
    try {
      const start = Date.now();
      await axios.get(`${API_URL}/catalog/${TEST_EVENT_ID}/dynamic-prices`, { headers });
      await new Promise(r => setTimeout(r, Math.random() * 2000));
      process.stdout.write(isBot ? '🛡️' : '🎫');
      return { success: true, isBot, duration: Date.now() - start };
    } catch (err) {
      process.stdout.write('❌');
      return { success: false, isBot, error: err.message };
    }
  }

  const results = [];
  const start = Date.now();
  for (let i = 0; i < TOTAL_USERS; i += CONCURRENCY) {
    const chunk = Array.from({ length: CONCURRENCY }, (_, j) => simulateUser(i + j));
    results.push(...await Promise.all(chunk));
  }

  const totalTime = (Date.now() - start) / 1000;
  const successful = results.filter(r => r.success).length;
  console.log(`\n✅ Successful Requests: ${successful} | 🛡️ Bot Deflections: ${results.filter(r => !r.success && r.isBot).length}`);
  console.log(`📈 Throughput: ${(successful / totalTime).toFixed(1)} req/sec\n`);
}

async function fanSimulator() {
  console.log('👥 Starting Fan Simulator (Autopilot active)...');
  while (true) {
    try {
      const catalogRes = await axios.get(`${API_URL}/catalog`);
      const events = catalogRes.data.data;
      if (events && events.length > 0) {
        for (let i = 0; i < 3; i++) {
          const event = events[Math.floor(Math.random() * events.length)];
          console.log(`👀 Fan is viewing event: ${event.name}`);
          await axios.get(`${API_URL}/catalog/${event._id}/dynamic-prices?cognitive_score=${(Math.random() * 0.5 + 0.5).toFixed(2)}`);
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        }
      }
      console.log('💤 Fan is taking a break...');
      await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
      console.warn('⚠️ Simulator Hiccup:', err.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

async function run() {
  const mode = process.argv[2];
  if (mode === 'bot') await simulateBot();
  else if (mode === 'stress') await stressTest();
  else if (mode === 'fan') await fanSimulator();
  else {
    console.log('Running sequential simulations (excluding infinite fan simulator)...');
    await simulateBot();
    await stressTest();
  }
}

run();
