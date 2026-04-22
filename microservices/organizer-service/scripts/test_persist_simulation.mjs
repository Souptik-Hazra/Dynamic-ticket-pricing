#!/usr/bin/env node
// test_persist_simulation.mjs
// Creates a sample Simulation with categories and seatMap via neo4jClient and verifies persistence

import neo4jClient from '../utils/neo4jClient.js';

async function run() {
  try {
    console.log('Starting test persistence...');

    const eventId = 'test-event-123';
    const eventName = 'Test Event Persist';
    const popularity = 0.42;
    const totalSeats = 100;

    const scores = [
      { name: 'VIP', score: 72 },
      { name: 'Standard', score: 45 }
    ];

    const seatMap = [
      { seatId: 'A1', categoryName: 'VIP' },
      { seatId: 'A2', categoryName: 'VIP' },
      { seatId: 'B1', categoryName: 'Standard' }
    ];

    const cypher = `
      // bind params early
      WITH $eventId AS _eid, $eventName AS _ename, $scores AS scores, $popularity AS popularity, $totalSeats AS totalSeats, $seatMap AS seatMap
      FOREACH (_ IN CASE WHEN _eid IS NOT NULL THEN [1] ELSE [] END |
        MERGE (ev:Event { eventId: _eid })
        ON CREATE SET ev.created = datetime()
        SET ev.name = coalesce(_ename, ev.name), ev.lastSimulated = datetime(), ev.id = _eid
      )
      FOREACH (_ IN CASE WHEN _eid IS NULL AND _ename IS NOT NULL THEN [1] ELSE [] END |
        MERGE (ev:Event { name: _ename })
        ON CREATE SET ev.created = datetime()
        SET ev.lastSimulated = datetime()
      )
      CREATE (s:Simulation { ts: datetime(), popularity: popularity, totalSeats: totalSeats })
      WITH s, scores, $eventId AS _eid, $eventName AS _ename
      UNWIND scores AS sc
      MERGE (c:Category { name: sc.name })
      CREATE (s)-[:HAS_SCORE { value: sc.score }]->(c)
      WITH s, _eid, _ename
      UNWIND $seatMap AS sm
      MERGE (seat:Seat { id: sm.seatId })
      SET seat.lastUpdated = datetime()
      MERGE (cat2:Category { name: sm.categoryName })
      MERGE (cat2)-[:HAS_SEAT]->(seat)
      MERGE (s)-[:ASSIGNED_SEAT]->(seat)
      WITH s, _eid, _ename
      MATCH (ev:Event)
      WHERE (_eid IS NOT NULL AND (ev.eventId = _eid OR ev.id = _eid)) OR (_eid IS NULL AND _ename IS NOT NULL AND ev.name = _ename)
      MERGE (ev)-[:HAS_SIMULATION]->(s)
      RETURN s
    `;

    console.log('Running write cypher...');
    await neo4jClient.runQuery(cypher, { eventId, eventName, scores, popularity, totalSeats, seatMap });
    console.log('Write complete. Querying counts...');

    const seatsRes = await neo4jClient.runQuery('MATCH (seat:Seat) WHERE seat.id IN $ids RETURN seat.id as id, seat.lastUpdated as lu', { ids: seatMap.map(s=>s.seatId) });
    console.log('Seats found:');
    seatsRes.forEach(r => console.log(' -', r.get ? r.get('id') : r.id));

    const relsRes = await neo4jClient.runQuery(`
      MATCH (ev:Event { eventId: $eventId })-[:HAS_SIMULATION]->(sim)-[:ASSIGNED_SEAT]->(seat)
      RETURN ev.eventId as eid, sim.ts as ts, collect(seat.id) as seatIds
    `, { eventId });
    console.log('Event-linked simulation seats:');
    if (relsRes && relsRes.length) {
      relsRes.forEach(r => console.log(' -', r.get ? r.get('seatIds') : r.seatIds));
    } else {
      console.log(' - none returned');
    }

    console.log('Test persistence complete.');
    process.exit(0);
  } catch (err) {
    console.error('Test persistence failed:', err && err.message);
    process.exit(1);
  }
}

run();
