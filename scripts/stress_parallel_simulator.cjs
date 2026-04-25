const axios = require('axios');
require('dotenv').config();

// 🛡️ Global Security Headers
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (MonolithTester; 1.0)';
axios.defaults.headers.common['Accept'] = 'application/json';

// ── Monolith Configuration ──
const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';
const URL = `${BASE_URL}/ai/simulator/neo4j`;
const AUTH_URL = `${BASE_URL}/auth/login`;

function randInt(min, max) { return Math.floor(Math.random()*(max-min+1))+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

const layoutTypes = ['stadium','arena','festival','theater'];
const stagePositions = ['center','front','left','right'];

function genPayload(idx){
  const numCats = randInt(1,4);
  const categories = [];
  for(let i=0;i<numCats;i++){
    const seats = randInt(100,1000);
    const booked = randInt(0, 50);
    categories.push({ 
      name: `Cat-${i+1}`, 
      seats, 
      bookedSeats: Array.from({length: booked}, (_, k) => `S${k}`) 
    });
  }
  return {
    eventName: `Parallel Stress`,
    eventId: `p-stress-${idx % 20}`,
    categories,
    layoutType: pick(layoutTypes),
    stagePosition: pick(stagePositions),
    venueMetrics: { exitsCount: randInt(2,12) },
    eventPopularity: Math.random()
  };
}

async function getAuthToken(){
  try {
    const res = await axios.post(AUTH_URL, { email: 'test-citizen@fanfever.local', password: 'password123' });
    return res.data.token;
  } catch(e) {
    console.warn('⚠️  Auth failed:', e.message);
    return null;
  }
}

async function run(total=500, concurrency=20){
  console.log(`🚀 Starting Parallel Stress Test [Total: ${total}, Concurrency: ${concurrency}]`);
  const token = await getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  let completed = 0, success = 0, failed = 0;

  const runOne = async (i) => {
    const payload = genPayload(i);
    try {
      const res = await axios.post(URL, payload, { headers, timeout: 20000 });
      completed++;
      if(res.status === 200 && res.data.stored) success++; else failed++;
      process.stdout.write(`✅ [#${i}] status=${res.status} stored=${!!res.data.stored}\r`);
    } catch(e) {
      failed++; completed++;
      console.error(`\n❌ [#${i}] Error: ${e.response?.status || e.message}`);
    }
  };

  const batches = Math.ceil(total / concurrency);
  for(let b=0; b<batches; b++){
    const tasks = [];
    for(let i=0; i<concurrency && (b*concurrency + i) < total; i++){
      tasks.push(runOne(b*concurrency + i));
    }
    await Promise.all(tasks);
    console.log(`\n📦 Batch ${b+1}/${batches} complete. [${Math.min((b+1)*concurrency, total)}/${total}]`);
  }

  console.log('========================================');
  console.log(`🏁 Parallel Test Finished.`);
  console.log(`Success: ${success} | Failed: ${failed} | Total: ${completed}`);
  console.log('========================================');
}

const args = process.argv.slice(2);
const total = parseInt(args[0],10) || 500;
const concurrency = parseInt(args[1],10) || 20;

run(total, concurrency).catch(e=>{ console.error('💥 Fatal:', e); process.exit(1); });
