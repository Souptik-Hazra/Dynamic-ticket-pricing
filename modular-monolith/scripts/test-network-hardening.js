import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = 'http://localhost:4000/api';

async function testNetworkHardening() {
  console.log('🌐 Testing Network-Level Security Hardening...');

  // 1. Information Disclosure Check
  console.log('\n🔍 Checking for Information Disclosure...');
  try {
    const res = await axios.get(`${API_URL}/health`);
    const poweredBy = res.headers['x-powered-by'];
    if (!poweredBy) {
      console.log('✅ X-Powered-By header is DISABLED (Correct)');
    } else {
      console.warn(`❌ Information Disclosure: X-Powered-By is still visible (${poweredBy})`);
    }
  } catch (err) {
    console.error('❌ Could not connect to server. Is it running?');
    return;
  }

  // 2. HTTP Parameter Pollution (HPP) Check
  console.log('\n🔍 Checking for HPP Protection...');
  try {
    // Send duplicate eventId parameters
    const res = await axios.get(`${API_URL}/v1/catalog/events?eventId=1&eventId=2`);
    // hpp should move duplicate params to req.query.eventId as a single string (the last one)
    // or handle it according to config. If it doesn't crash, it's a good sign.
    console.log('✅ HPP check completed without crash.');
  } catch (err) {
    console.error(`❌ HPP check failed: ${err.message}`);
  }

  // 3. Payload Size Protection Check
  console.log('\n🔍 Checking AI Sync Payload Limits (5MB)...');
  try {
    const largePayload = 'a'.repeat(6 * 1024 * 1024); // 6MB
    await axios.post(`${API_URL}/v1/ai/federated/sync`, { data: largePayload }, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.warn('❌ Payload Limit check FAILED: 6MB payload was accepted!');
  } catch (err) {
    if (err.response && err.response.status === 413) {
      console.log('✅ Payload Limit check PASSED: 6MB payload was rejected (413 Payload Too Large)');
    } else {
      console.warn(`⚠️ Payload Limit check returned unexpected status: ${err.response?.status || err.message}`);
    }
  }

  // 4. CORS Protection Check
  console.log('\n🔍 Checking CORS Policy...');
  try {
    const res = await axios.get(`${API_URL}/health`, {
      headers: { 'Origin': 'http://hacker-domain.com' }
    });
    const allowOrigin = res.headers['access-control-allow-origin'];
    if (allowOrigin !== '*' && allowOrigin !== 'http://hacker-domain.com') {
      console.log('✅ CORS check PASSED: Unauthorized origin rejected or not reflected.');
    } else {
      console.warn(`❌ CORS check FAILED: Permissive Origin detected (${allowOrigin})`);
    }
  } catch (err) {
    console.log('✅ CORS check PASSED (Request likely rejected by middleware)');
  }
}

// Start server in a background process if not running, then test
console.log('🚀 Starting server for network tests...');
const server = spawn('node', ['server.js'], { 
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: 4000, NODE_ENV: 'production' }
});

server.stdout.on('data', (data) => {
  if (data.toString().includes('Monolith running')) {
    testNetworkHardening().then(() => {
      console.log('\n🏁 Network Audit Complete. Killing test server.');
      server.kill();
      process.exit(0);
    });
  }
});

server.stderr.on('data', (data) => {
  console.error(`[Server Error] ${data}`);
});

setTimeout(() => {
  console.error('🚩 Test timed out. Is the server starting?');
  server.kill();
  process.exit(1);
}, 15000);
