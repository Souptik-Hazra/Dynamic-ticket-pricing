const axios = require('axios');

// ── Unified Monolith Configuration ──
const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';
const SIM_URL = `${BASE_URL}/ai/simulator/neo4j`;
const AUTH_URL = `${BASE_URL}/auth/login`;

const layoutTypes = ['stadium','arena','festival','theater'];
const stagePositions = ['center','front','left','right'];

function randInt(min, max) { return Math.floor(Math.random()*(max-min+1))+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function genPayload(idx){
  const numCats = randInt(1,4);
  const categories = [];
  for(let i=0;i<numCats;i++){
    const seats = randInt(50,500);
    const bookedCount = randInt(0, Math.min(20, Math.floor(seats/10)));
    const blockedCount = randInt(0, Math.min(20, Math.floor(seats/10)));
    categories.push({
      name: `Category-${i+1}`,
      seats,
      bookedSeats: Array.from({length: bookedCount}, (_, i) => `S${i}`),
      blockedSeats: Array.from({length: blockedCount}, (_, i) => `B${i}`)
    });
  }

  return {
    eventName: `Stress Test Event`,
    eventId: `stress-${idx % 10}`,
    categories,
    layoutType: pick(layoutTypes),
    stagePosition: pick(stagePositions),
    venueMetrics: {
      exitsCount: randInt(1,8),
      aisleWidth: pick(['narrow','standard','wide']),
      securitySpeed: pick(['slow','normal','fast'])
    },
    eventPopularity: Math.random()
  };
}

async function run(count=50, delay=150){
  console.log(`🚀 Starting Stress Test on ${BASE_URL}...`);
  let stored=0, total=0, errors=0;

  // 1. Get Auth Token
  let token = null;
  try {
    const creds = { email: 'test-citizen@fanfever.local', password: 'password123' };
    const res = await axios.post(AUTH_URL, creds, { timeout: 5000 });
    if(res.data && res.data.token) token = res.data.token;
    console.log('✅ Auth token acquired.');
  } catch(e) {
    console.warn('⚠️  Auth failed (using unauthenticated requests):', e.message);
  }

  // 2. Run Stress Loop
  for(let i=0;i<count;i++){
    const payload = genPayload(i);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(SIM_URL, payload, { timeout: 10000, headers });
      total++;
      if(res.data.stored) stored++;
      console.log(`[${i+1}/${count}] status=${res.status} stored=${!!res.data.stored} event=${payload.eventId}`);
    } catch(err) {
      errors++;
      console.error(`[${i+1}/${count}] request failed:`, err.response?.data?.error || err.message);
    }
    if (delay > 0) await new Promise(r=>setTimeout(r, delay));
  }
  
  console.log('----------------------------------------');
  console.log(`🏁 Finished. Total: ${total} | Stored: ${stored} | Errors: ${errors}`);
}

const args = process.argv.slice(2);
const n = parseInt(args[0],10) || 50;
const d = parseInt(args[1],10) || 150;

run(n,d).catch(e=>{ console.error('💥 Fatal:', e); process.exit(1); });
