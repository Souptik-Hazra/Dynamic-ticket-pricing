const fs = require('fs');
const path = require('path');
const fetch = global.fetch || require('node-fetch');

const AUTH_URL = process.env.AUTH_URL || 'http://localhost:4001/api/auth/signup';
const GATEWAY_SIM_URL = process.env.GATEWAY_SIM_URL || 'http://localhost:3001/api/simulator/neo4j';

async function main(){
  try{
    const signupPayloadPath = path.join(__dirname, '..', 'microservices', 'authentication-service', 'scripts', 'signup_payload.json');
    const simPayloadPath = path.join(__dirname, '..', 'microservices', 'organizer-service', 'scripts', 'test_payload.json');

    const signupPayload = JSON.parse(fs.readFileSync(signupPayloadPath, 'utf8'));
    const simPayload = JSON.parse(fs.readFileSync(simPayloadPath, 'utf8'));

    console.log('Signing up test user (or signing in if already exists)...');
    let token = null;
    try{
      const su = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(signupPayload),
      });
      const suJson = await su.json().catch(()=>({error:'invalid-json'}));
      if(su.ok && suJson.token){
        token = suJson.token;
        console.log('Signup succeeded.');
      } else if(su.status === 409){
        console.log('User already exists; attempting signin...');
      } else {
        console.error('Signup error:', su.status, suJson);
      }
    }catch(e){
      console.error('Signup request failed:', e && e.message ? e.message : e);
    }

    // If token not set, try signin
    if(!token){
      try{
        const signinUrl = AUTH_URL.replace('/signup', '/signin');
        const creds = { email: signupPayload.email, password: signupPayload.password };
        const s = await fetch(signinUrl, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(creds),
        });
        const sJson = await s.json().catch(()=>({error:'invalid-json'}));
        if(s.ok && sJson.token){
          token = sJson.token;
          console.log('Signin succeeded.');
        } else {
          console.error('Signin failed:', s.status, sJson);
          process.exit(2);
        }
      }catch(e){
        console.error('Signin request failed:', e && e.message ? e.message : e);
        process.exit(2);
      }
    }
    console.log('Got JWT, now POSTing to gateway simulator...');

    const res = await fetch(GATEWAY_SIM_URL, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(simPayload),
    }).catch(e=>({error:e}));

    if(res && res.error){
      console.error('Request to gateway failed:', res.error.message || res.error);
      process.exit(3);
    }

    const body = await res.json().catch(()=>null);
    console.log('Gateway response status:', res.status);
    console.log('Gateway response body:', JSON.stringify(body));

    // Basic assertions: non-fallback and scores for each category are numbers
    if (!body) {
      console.error('Empty body from gateway');
      process.exit(4);
    }
    if (body.fallback) {
      console.error('Simulator returned fallback mode — Neo4j not used');
      process.exit(5);
    }
    if (body.stored !== true) {
      console.error('Simulator did not persist results to Neo4j (stored flag false)');
      process.exit(7);
    }
    const inputPayload = simPayload;
    const missing = [];
    inputPayload.categories.forEach(c => {
      if (!body.scores || typeof body.scores[c.name] !== 'number') missing.push(c.name);
    });
    if (missing.length) {
      console.error('Missing or invalid score entries for categories:', missing);
      process.exit(6);
    }
    console.log('Integration test passed: scores present for all categories.');
    process.exit(0);
  }catch(err){
    console.error('Test script error:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

main();
