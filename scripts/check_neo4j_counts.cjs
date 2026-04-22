const neo4j = require('neo4j-driver');
require('dotenv').config();

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
// match the organizer service env names and defaults
const user = process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j';
const pass = process.env.NEO4J_PASSWORD || process.env.NEO4J_PASS || 'password';

async function main(){
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, pass));
  const session = driver.session();
  try{
    const eventName = process.argv[2] || 'Demo Concert';
    const r1 = await session.run('MATCH (e:Event {name:$name}) RETURN count(e) AS cnt', { name: eventName });
    const r2 = await session.run('MATCH (e:Event {name:$name})-[:HAS_SIMULATION]->(s) RETURN count(s) AS sims', { name: eventName });
    const r3 = await session.run('MATCH (e:Event) WHERE e.eventId IS NOT NULL RETURN count(DISTINCT e.eventId) AS withIds');
    const r4 = await session.run('MATCH (s:Simulation) RETURN count(s) AS simCount');
    const cnt = r1.records[0].get('cnt').toNumber();
    const sims = r2.records[0].get('sims').toNumber();
    const withIds = r3.records[0].get('withIds').toNumber();
    const simCount = r4.records[0].get('simCount').toNumber();
    console.log(`Event('${eventName}') nodes: ${cnt}`);
    console.log(`Simulations linked to '${eventName}': ${sims}`);
    console.log(`Distinct Events with eventId property: ${withIds}`);
    console.log(`Total Simulation nodes: ${simCount}`);
    if(simCount>0){
      const r5 = await session.run('MATCH (s:Simulation) RETURN s LIMIT 3');
      console.log('Sample Simulation nodes:');
      r5.records.forEach((rec,i)=>{
        const s = rec.get('s');
        const props = s.properties || s;
        console.log(` - #${i}:`, Object.keys(props).reduce((o,k)=>{ o[k]=props[k]; return o; },{}));
      });
    }
    const r6 = await session.run('MATCH (e:Event) RETURN e LIMIT 10');
    console.log('Sample Event nodes:');
    r6.records.forEach((rec,i)=>{
      const e = rec.get('e');
      const props = e.properties || e;
      console.log(` - #${i}:`, Object.keys(props).reduce((o,k)=>{ o[k]=props[k]; return o; },{}));
    });
    const r7 = await session.run('MATCH (ev)-[r:HAS_SIMULATION]->(s) RETURN count(r) AS relCount');
    const relCount = r7.records[0].get('relCount').toNumber();
    console.log(`Total HAS_SIMULATION relationships: ${relCount}`);
    if(relCount>0){
      const r8 = await session.run('MATCH (ev)-[r:HAS_SIMULATION]->(s) RETURN ev, s LIMIT 5');
      console.log('Sample relationships:');
      r8.records.forEach((rec,i)=>{
        const ev = rec.get('ev');
        const s = rec.get('s');
        const evp = ev.properties || ev;
        const sp = s.properties || s;
        console.log(` - #${i}: ev=${JSON.stringify(evp)}, s=${JSON.stringify({ popularity: sp.popularity, totalSeats: sp.totalSeats })}`);
      });
    }
  }catch(e){
    console.error('Neo4j check failed:', e && e.message);
    process.exitCode = 2;
  }finally{
    await session.close();
    await driver.close();
  }
}

main();
