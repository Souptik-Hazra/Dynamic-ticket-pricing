const neo4j = require('neo4j-driver');
const path = require('path');
const fs = require('fs');

// ── Load Environment Variables (Monolith Priority) ──
const rootEnv = path.join(__dirname, '..', '.env');
const monolithEnv = path.join(__dirname, '..', 'modular-monolith', '.env');

if (fs.existsSync(monolithEnv)) {
  require('dotenv').config({ path: monolithEnv });
} else {
  require('dotenv').config({ path: rootEnv });
}

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USER || 'neo4j';
const pass = process.env.NEO4J_PASSWORD || 'password';

async function main(){
  console.log(`🔌 Connecting to Neo4j at ${uri}...`);
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
  const session = driver.session();
  
  try {
    const eventName = process.argv[2] || 'Demo Concert';
    
    const queries = {
      eventNodes: 'MATCH (e:Event {name:$name}) RETURN count(e) AS cnt',
      simulations: 'MATCH (e:Event {name:$name})-[:HAS_SIMULATION]->(s) RETURN count(s) AS sims',
      distinctEvents: 'MATCH (e:Event) WHERE e.eventId IS NOT NULL RETURN count(DISTINCT e.eventId) AS withIds',
      totalSims: 'MATCH (s:Simulation) RETURN count(s) AS simCount',
      relationships: 'MATCH (ev)-[r:HAS_SIMULATION]->(s) RETURN count(r) AS relCount'
    };

    const results = {};
    for (const [key, cypher] of Object.entries(queries)) {
      const res = await session.run(cypher, { name: eventName });
      results[key] = res.records[0].get(0).toNumber();
    }

    console.log('----------------------------------------');
    console.log(`📌 Results for '${eventName}':`);
    console.log(` - Event Nodes: ${results.eventNodes}`);
    console.log(` - Linked Simulations: ${results.simulations}`);
    console.log(` - Total Distinct Events: ${results.distinctEvents}`);
    console.log(` - Total Simulation Nodes: ${results.totalSims}`);
    console.log(` - Total HAS_SIMULATION relationships: ${results.relationships}`);
    console.log('----------------------------------------');

    if(results.totalSims > 0){
      const res = await session.run('MATCH (s:Simulation) RETURN s ORDER BY s.timestamp DESC LIMIT 1');
      const latest = res.records[0].get('s').properties;
      console.log('Latest Simulation Payload:');
      console.log(JSON.stringify(latest, null, 2));
    }

  } catch (e) {
    console.error('❌ Neo4j Check Failed:', e.message);
    process.exit(1);
  } finally {
    await session.close();
    await driver.close();
  }
}

main();
