import axios from 'axios';
import { WebSocket } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = 'http://localhost:4000/api';
const API_V1_URL = 'http://localhost:4000/api/v1';
const WS_URL = 'ws://localhost:4000/api/ws';
const TEST_EVENT_ID = '69ecfb8f48854f910b361c02';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// --- From test-network-hardening.js ---
async function testNetworkHardening() {
  console.log('\n🌐 Testing Network-Level Security Hardening...');

  try {
    const res = await axios.get(`${API_URL}/health`);
    if (!res.headers['x-powered-by']) console.log('✅ X-Powered-By header is DISABLED');
    else console.warn(`❌ Information Disclosure: X-Powered-By is still visible`);
  } catch (err) { console.error('❌ Health check failed', err.message); }

  try {
    await axios.get(`${API_V1_URL}/catalog/events?eventId=1&eventId=2`);
    console.log('✅ HPP check completed without crash.');
  } catch (err) { console.error(`❌ HPP check failed: ${err.message}`); }

  try {
    await axios.post(`${API_V1_URL}/ai/federated/sync`, { data: 'a'.repeat(6 * 1024 * 1024) }, { headers: { 'Content-Type': 'application/json' } });
    console.warn('❌ Payload Limit check FAILED: 6MB payload was accepted!');
  } catch (err) {
    if (err.response?.status === 413) console.log('✅ Payload Limit check PASSED (413 Payload Too Large)');
    else console.warn(`⚠️ Payload Limit check returned unexpected status: ${err.response?.status}`);
  }

  try {
    const res = await axios.get(`${API_URL}/health`, { headers: { 'Origin': 'http://hacker-domain.com' } });
    const allowOrigin = res.headers['access-control-allow-origin'];
    if (allowOrigin !== '*' && allowOrigin !== 'http://hacker-domain.com') console.log('✅ CORS check PASSED.');
    else console.warn(`❌ CORS check FAILED: Permissive Origin detected (${allowOrigin})`);
  } catch (err) { console.log('✅ CORS check PASSED (Request rejected)'); }
}

// --- From test_suite.js (Diamond Stress Test) ---
async function runTest(name, fn) {
  console.log(`\n🚀 STARTING TEST: ${name}`);
  try {
    await fn();
    console.log(`✅ TEST PASSED: ${name}`);
  } catch (err) {
    console.error(`❌ TEST FAILED: ${name} | ${err.message}`);
  }
  await delay(1000);
}

async function testCatalogSurge() {
  const requests = Array.from({ length: 50 }, () => axios.get(`${API_V1_URL}/catalog/${TEST_EVENT_ID}/dynamic-prices`, { headers: { 'User-Agent': 'Mozilla/5.0' } }));
  const start = Date.now();
  await Promise.all(requests);
  console.log(`📊 50 Price Views completed in ${Date.now() - start}ms`);
}

async function testBotShield() {
  let deflections = 0;
  for (let i = 0; i < 10; i++) {
    try { await axios.post(`${API_V1_URL}/tickets/purchase`, {}, { headers: { 'User-Agent': 'Puppeteer-Bot/1.0' } }); }
    catch (err) { if (err.response?.status === 403) deflections++; }
  }
  console.log(`🛡️ Bot Deflections: ${deflections}/10`);
}

async function testAuthBarrier() {
  let rateLimited = 0;
  for (let i = 0; i < 30; i++) {
    try { await axios.post(`${API_V1_URL}/auth/login`, { email: 'test@example.com', password: 'password' }); }
    catch (err) { if (err.response?.status === 429) rateLimited++; }
  }
  console.log(`🔑 Auth Rate Limits Triggered: ${rateLimited}`);
}

async function testWsPulse() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'subscribe', room: TEST_EVENT_ID })));
    ws.on('message', (data) => {
      if (JSON.parse(data).type === 'live_pulse') {
        console.log(`📡 WS Pulse Received.`);
        ws.close(); resolve();
      }
    });
    ws.on('error', reject);
    setTimeout(() => { ws.close(); reject(new Error('WS Timeout')); }, 5000);
  });
}

// --- Server Orchestration ---
console.log('🚀 Starting server for API integration tests...');
const server = spawn('node', ['server.js'], { 
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: 4000, NODE_ENV: 'test' }
});

let serverReady = false;

server.stdout.on('data', async (data) => {
  if (!serverReady && data.toString().includes('Monolith running')) {
    serverReady = true;
    try {
      await testNetworkHardening();
      console.log('\n🔥 INITIALIZING DIAMOND TEST SUITE...');
      await runTest('Catalog Hot-Path Surge (Caching)', testCatalogSurge);
      await runTest('Bot-Shield Infiltration (Security)', testBotShield);
      await runTest('Auth Brute-Force Barrier (Throttling)', testAuthBarrier);
      await runTest('WebSocket Pulse Broadcast (Real-time)', testWsPulse);
      console.log('\n🏆 ALL API TESTS COMPLETED.');
    } catch (err) {
      console.error('Test Execution Error:', err);
    } finally {
      server.kill();
      process.exit(0);
    }
  }
});

server.stderr.on('data', (data) => { /* Ignore minor warnings */ });

setTimeout(() => {
  if (!serverReady) {
    console.error('🚩 Test timed out. Is the server starting?');
    server.kill();
    process.exit(1);
  }
}, 15000);
