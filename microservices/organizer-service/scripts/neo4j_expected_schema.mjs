import neo4jClient from '../utils/neo4jClient.js';

(async function setupSchema() {
  try {
    console.log('[neo4j-schema] Creating constraints and indexes required by OrganizerService');

    const stmts = [
      // Uniqueness / existence where appropriate
      `CREATE CONSTRAINT event_eventId_unique IF NOT EXISTS FOR (e:Event) REQUIRE e.eventId IS UNIQUE`,
      `CREATE CONSTRAINT seat_id_unique IF NOT EXISTS FOR (s:Seat) REQUIRE s.id IS UNIQUE`,
      `CREATE CONSTRAINT category_name_unique IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE`,
      // Helpful indexes for lookups
      `CREATE INDEX event_name_index IF NOT EXISTS FOR (e:Event) ON (e.name)`,
      `CREATE INDEX simulation_ts_index IF NOT EXISTS FOR (s:Simulation) ON (s.ts)`,
      `CREATE INDEX seat_lastUpdated_index IF NOT EXISTS FOR (s:Seat) ON (s.lastUpdated)`,
    ];

    for (const s of stmts) {
      try {
        console.log('[neo4j-schema] Running:', s.replace(/\s+/g,' ').slice(0,200));
        await neo4jClient.runQuery(s);
      } catch (err) {
        console.warn('[neo4j-schema] Statement failed (may already exist or Neo4j older version):', err.message || err);
      }
    }

    console.log('[neo4j-schema] Done creating constraints/indexes. Now validating expected relationship patterns.');

    // Sanity-check queries to confirm expected relationships exist (may return zero rows if DB empty)
    const checks = [
      {
        name: 'Event nodes count',
        query: 'MATCH (e:Event) RETURN count(e) AS cnt'
      },
      {
        name: 'Category nodes count',
        query: 'MATCH (c:Category) RETURN count(c) AS cnt'
      },
      {
        name: 'Seat nodes count',
        query: 'MATCH (s:Seat) RETURN count(s) AS cnt'
      },
      {
        name: 'Simulation nodes count',
        query: 'MATCH (s:Simulation) RETURN count(s) AS cnt'
      },
      {
        name: 'Event -> Simulation relationships',
        query: 'MATCH (e:Event)-[r:HAS_SIMULATION]->(s:Simulation) RETURN count(r) AS cnt'
      },
      {
        name: 'Simulation -> Category (HAS_SCORE) relationships',
        query: 'MATCH (s:Simulation)-[r:HAS_SCORE]->(c:Category) RETURN count(r) AS cnt'
      },
      {
        name: 'Category -> Seat (HAS_SEAT) relationships',
        query: 'MATCH (c:Category)-[r:HAS_SEAT]->(seat:Seat) RETURN count(r) AS cnt'
      },
      {
        name: 'Simulation -> Seat (ASSIGNED_SEAT) relationships',
        query: 'MATCH (s:Simulation)-[r:ASSIGNED_SEAT]->(seat:Seat) RETURN count(r) AS cnt'
      }
    ];

    for (const ck of checks) {
      try {
        const recs = await neo4jClient.runQuery(ck.query);
        if (recs && recs.length) {
          const val = recs[0].get ? recs[0].get('cnt') : (recs[0].cnt || 0);
          console.log(`[neo4j-schema] ${ck.name}: ${val}`);
        } else {
          console.log(`[neo4j-schema] ${ck.name}: 0 (no records returned)`);
        }
      } catch (err) {
        console.warn('[neo4j-schema] Check failed:', ck.name, err.message || err);
      }
    }

    console.log('\n[neo4j-schema] Expected model (nodes & relationships) for OrganizerService:\n');
    console.log('- Node types:');
    console.log('  * :Event { eventId?, name, created, lastSimulated, id? }');
    console.log('  * :Simulation { ts, popularity, totalSeats }');
    console.log('  * :Category { name }');
    console.log('  * :Seat { id, lastUpdated }\n');

    console.log('- Relationship expectations:');
    console.log('  * (Event)-[:HAS_SIMULATION]->(Simulation)');
    console.log('  * (Simulation)-[:HAS_SCORE { value }]->(Category)');
    console.log('  * (Category)-[:HAS_SEAT]->(Seat)');
    console.log('  * (Simulation)-[:ASSIGNED_SEAT]->(Seat)');
    console.log('\nTips:');
    console.log('  - Use `eventId` when available to avoid name-collisions.');
    console.log('  - Category `name` and Seat `id` are unique keys in the graph for fast lookups.');
    console.log('  - If you plan to add more properties (e.g., seat coordinates), store them on `Seat` nodes (e.g., row, col) for spatial algorithms.');

    await neo4jClient.closeDriver();
    process.exit(0);
  } catch (err) {
    console.error('[neo4j-schema] Failed:', err.message || err);
    process.exit(2);
  }
})();
