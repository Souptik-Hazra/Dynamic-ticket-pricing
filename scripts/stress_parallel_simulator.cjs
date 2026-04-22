const axios = require('axios');
// present a browser-like UA globally to avoid BotShield rejecting axios default
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
axios.defaults.headers.common['Accept'] = 'application/json, text/plain, */*';
require('dotenv').config();

const BASE = process.env.GATEWAY_SIM_URL || process.env.API_URL || 'http://localhost:3001';
const URL = `${BASE.replace(/\/\/$/, '')}/api/simulator/neo4j`;
// Prefer direct auth service (matches existing stress_simulator.cjs); can be overridden with AUTH_URL
const AUTH = process.env.AUTH_URL || 'http://localhost:4001/api/auth';

function randInt(min, max) { return Math.floor(Math.random()*(max-min+1))+min; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

const layoutTypes = ['stadium','arena','festival','theater'];
const stagePositions = ['center','front','left','right'];

function genPayload(idx){
  const numCats = randInt(1,4);
  const categories = [];
  for(let i=0;i<numCats;i++){
    const seats = randInt(50,500);
    const blockedCount = randInt(0, Math.min(20, Math.floor(seats/10)));
    const bookedCount = randInt(0, Math.min(50, Math.floor(seats/5)));
    const blockedSeats = [];
    const bookedSeats = [];
    for(let b=0;b<blockedCount;b++) blockedSeats.push(`B${randInt(1,seats)}`);
    for(let b=0;b<bookedCount;b++) bookedSeats.push(`S${randInt(1,seats)}`);
    categories.push({ name: `Category-${i+1}`, seats, blockedSeats, bookedSeats });
  }
  return {
    eventName: `Demo Concert`,
    eventId: `demo-${idx % 10}`,
    categories,
    layoutType: pick(layoutTypes),
    stagePosition: pick(stagePositions),
    venueMetrics: { exitsCount: randInt(1,8), aisleWidth: pick(['narrow','standard','wide']), securitySpeed: pick(['slow','normal','fast']) },
    eventPopularity: Math.random()
  };
}

async function authToken(){
  try{
    const signup = { name: 'Parallel Tester', email: 'parallel+neo4j@local', password: 'password123' };
    await axios.post(`${AUTH}/signup`, signup).catch(()=>{});
    const res = await axios.post(`${AUTH}/signin`, { email: signup.email, password: signup.password });
    if(res && res.data && res.data.token) return res.data.token;
    return null;
  }catch(e){ console.warn('Auth failed:', e && e.message); return null; }
}

async function run(total=1000, concurrency=100){
  const token = await authToken();
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  };
  const headers = token ? { ...baseHeaders, Authorization: `Bearer ${token}`, 'X-Request-ID': `stress-${Date.now()}` } : { ...baseHeaders, 'X-Request-ID': `stress-${Date.now()}` };
  let completed = 0, success = 0, failed = 0;

  const runOne = async (i) => {
    const payload = genPayload(i);
    let attempts = 0;
    const maxAttempts = 4;
    const baseDelay = 200; // ms
    while(attempts < maxAttempts){
      attempts++;
      try{
        const res = await axios.post(URL, payload, { headers, timeout: 15000 });
        completed++;
        if(res.status===200) success++; else failed++;
        console.log(`+ [ok] #${i} status=${res.status} stored=${!!(res.data && res.data.stored)} attempts=${attempts}`);
        return { ok: true, body: res.data };
      }catch(e){
        const status = e && e.response && e.response.status;
        const body = e && e.response && e.response.data;
        const msg = status ? `${status} ${JSON.stringify(body)}` : (e && e.message) || 'unknown';
        // Retry on 429 (backoff) and on transient 5xx
        if(status === 429 || (status >= 500 && status < 600)){
          const wait = baseDelay * Math.pow(2, attempts-1);
          console.warn(`- [retry] #${i} attempt=${attempts} status=${status} waiting ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        // For botShield 403 security_violation, we won't retry here
        failed++; completed++;
        console.error(`- [err] #${i} ${msg} attempts=${attempts}`);
        return { ok: false, err: msg };
      }
    }
    // reached max attempts
    failed++; completed++;
    const finalMsg = `failed after ${maxAttempts} attempts`;
    console.error(`- [err] #${i} ${finalMsg}`);
    return { ok: false, err: finalMsg };
  };

  const batches = Math.ceil(total / concurrency);
  for(let b=0;b<batches;b++){
    const tasks = [];
    for(let i=0;i<concurrency && (b*concurrency + i) < total;i++){
      tasks.push(runOne(b*concurrency + i));
    }
    await Promise.all(tasks);
    process.stdout.write(`Progress: ${Math.min((b+1)*concurrency, total)}/${total}\r`);
  }

  console.log(`\nFinished parallel test. total=${total} success=${success} failed=${failed} completed=${completed}`);
}

const args = process.argv.slice(2);
const total = parseInt(args[0],10) || 1000;
const concurrency = parseInt(args[1],10) || 100;

run(total, concurrency).catch(e=>{ console.error('Fatal:', e); process.exit(1); });
