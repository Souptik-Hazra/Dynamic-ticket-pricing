import axios from 'axios';
import { WebSocket } from 'ws';

/**
 * 💎 Diamond Stress Test Suite (Phase 11)
 * 
 * Sequentially tests every "Legendary" layer of the platform.
 */

const API_URL = 'http://localhost:4000/api/v1';
const WS_URL = 'ws://localhost:4000/api/ws';
const TEST_EVENT_ID = '69ecfb8f48854f910b361c02';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function runTest(name, fn) {
  console.log(`\n🚀 STARTING TEST: ${name}`);
  console.log('---------------------------------------------------------');
  try {
    await fn();
    console.log(`✅ TEST PASSED: ${name}`);
  } catch (err) {
    console.error(`❌ TEST FAILED: ${name} | ${err.message}`);
  }
  console.log('---------------------------------------------------------');
  await delay(2000); // Cooling period
}

// --- 1. Catalog Surge (Caching) ---
async function testCatalogSurge() {
  const requests = Array.from({ length: 50 }, () => 
    axios.get(`${API_URL}/catalog/${TEST_EVENT_ID}/dynamic-prices`, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' } 
    })
  );
  const start = Date.now();
  await Promise.all(requests);
  const duration = Date.now() - start;
  console.log(`📊 50 Price Views completed in ${duration}ms (Avg: ${duration/50}ms)`);
}

// --- 2. Bot Infiltration (Shield) ---
async function testBotShield() {
  let deflections = 0;
  for (let i = 0; i < 10; i++) {
    try {
      await axios.post(`${API_URL}/tickets/purchase`, {}, { 
        headers: { 'User-Agent': 'Puppeteer-Bot/1.0' } 
      });
    } catch (err) {
      if (err.response?.status === 403) deflections++;
    }
  }
  console.log(`🛡️ Bot Deflections: ${deflections}/10 (Expected: 10/10)`);
}

// --- 3. Auth Barrier (Rate Limiter) ---
async function testAuthBarrier() {
  let rateLimited = 0;
  for (let i = 0; i < 30; i++) {
    try {
      await axios.post(`${API_URL}/auth/login`, { email: 'test@example.com', password: 'password' });
    } catch (err) {
      if (err.response?.status === 429) rateLimited++;
    }
  }
  console.log(`🔑 Auth Rate Limits Triggered: ${rateLimited} (Expected > 0)`);
}

// --- 4. WebSocket Pulse (Broadcast) ---
async function testWsPulse() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let pulsesReceived = 0;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', room: TEST_EVENT_ID }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'live_pulse') {
        pulsesReceived++;
        if (pulsesReceived >= 1) {
          console.log(`📡 WS Pulse Received: ${msg.viewerCount} viewers connected.`);
          ws.close();
          resolve();
        }
      }
    });

    ws.on('error', reject);
    setTimeout(() => reject(new Error('WS Timeout')), 15000);
  });
}

async function masterTestSuite() {
  console.log('🔥 INITIALIZING DIAMOND TEST SUITE...');
  
  await runTest('Catalog Hot-Path Surge (Caching)', testCatalogSurge);
  await runTest('Bot-Shield Infiltration (Security)', testBotShield);
  await runTest('Auth Brute-Force Barrier (Throttling)', testAuthBarrier);
  await runTest('WebSocket Pulse Broadcast (Real-time)', testWsPulse);
  
  console.log('\n🏆 ALL DIAMOND TESTS COMPLETED SEQUENTIALLY.');
}

masterTestSuite().catch(console.error);
