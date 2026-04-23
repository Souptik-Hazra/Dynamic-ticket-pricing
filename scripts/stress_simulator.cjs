const axios = require('axios');

const BASE = process.env.GATEWAY_SIM_URL || 'http://localhost:4013';
const URL = `${BASE}/api/simulator/neo4j`;
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:4001/api/auth';

const layoutTypes = ['stadium','arena','festival','theater'];
const stagePositions = ['center','front','left','right'];

function randInt(min, max) { return Math.floor(Math.random()*(max-min+1))+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function genPayload(idx){
  const numCats = randInt(1,4);
  const categories = [];
  for(let i=0;i<numCats;i++){
    const seats = randInt(50,500);
    const blockedCount = randInt(0, Math.min(20, Math.floor(seats/10)));
    const bookedCount = randInt(0, Math.min(50, Math.floor(seats/5)));
    const blockedSeats = [];
    const bookedSeats = [];
    for(let b=0;b<blockedCount;b++) blockedSeats.push(randInt(1,seats));
    for(let b=0;b<bookedCount;b++) bookedSeats.push(randInt(1,seats));
    categories.push({
      name: `Category-${i+1}`,
      seats,
      blockedSeats,
      bookedSeats
    });
  }

  return {
    eventName: `Demo Concert`,
    eventId: `demo-${idx % 5}`,
    categories,
    layoutType: pick(layoutTypes),
    stagePosition: pick(stagePositions),
    venueMetrics: {
      exitsCount: randInt(1,8),
      aisleWidth: pick(['narrow','standard','wide']),
      securitySpeed: pick(['slow','normal','fast'])
    },
    eventPopularity: randInt(1,100)
  };
}

async function run(count=50, delay=150){
  let stored=0, total=0, errors=0;
  // Ensure we have an auth token
  let token = null;
  try{
    const signupPayload = { name: 'Stress Tester', email: 'stress+neo4j@local', password: 'password123' };
    // Try signup (may 409)
    await axios.post(`${AUTH_URL}/signup`, signupPayload, { timeout: 5000 }).then(r=>{ if(r.data && r.data.token) token = r.data.token; }).catch(()=>{});
    if(!token){
      const creds = { email: 'stress+neo4j@local', password: 'password123' };
      const signin = await axios.post(`${AUTH_URL}/signin`, creds, { timeout: 5000 });
      if(signin && signin.data && signin.data.token) token = signin.data.token;
    }
  }catch(e){ console.warn('Auth step failed:', e && e.message); }

  for(let i=0;i<count;i++){
    const payload = genPayload(i);
    try{
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(URL, payload, { timeout: 10000, headers });
      total++;
      const body = res.data || {};
      if(body.stored) stored++;
      console.log(`[${i+1}/${count}] status=${res.status} stored=${!!body.stored} scores=${JSON.stringify(body.scores||{})}`);
    }catch(err){
      errors++;
      console.error(`[${i+1}/${count}] request failed:`, err.message);
    }
    await new Promise(r=>setTimeout(r, delay));
  }
  console.log(`Finished. total=${total} stored=${stored} errors=${errors}`);
}

const args = process.argv.slice(2);
const n = parseInt(args[0],10) || 50;
const d = parseInt(args[1],10) || 150;

run(n,d).catch(e=>{ console.error('Fatal:', e); process.exit(1); });
