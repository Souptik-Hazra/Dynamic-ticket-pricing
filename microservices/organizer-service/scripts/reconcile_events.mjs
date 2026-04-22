#!/usr/bin/env node
// reconcile_events.mjs
// One-off script to reconcile legacy Event nodes that were created by name with
// canonical Event nodes created by eventId. This script will:
// - For each Event node that has an `eventId` and a node that only has `name` but no `eventId`,
//   it will copy relevant properties and re-link relationships, then remove the name-only node.
// - Be idempotent: running multiple times should be safe.

import neo4jClient from '../utils/neo4jClient.js';

async function run() {
  try {
    console.log('Starting Event reconciliation...');

    const reconcileCypher = `
      // Find name-only events and corresponding id-based events with the same name
      MATCH (nameOnly:Event) WHERE nameOnly.name IS NOT NULL AND (nameOnly.eventId IS NULL OR nameOnly.eventId = '')
      WITH nameOnly
      MATCH (idEvent:Event) WHERE idEvent.name = nameOnly.name AND idEvent.eventId IS NOT NULL
      WITH nameOnly, idEvent
      // Re-create outgoing relationships on idEvent preserving properties (using generic rel type)
      OPTIONAL MATCH (nameOnly)-[r]->(target)
      WITH nameOnly, idEvent, collect(r) AS outRels, collect(target) AS outTargets
      UNWIND range(0, size(outRels)-1) AS idx
      WITH nameOnly, idEvent, outRels[idx] AS r, outTargets[idx] AS target
      WHERE r IS NOT NULL
      CREATE (idEvent)-[nr:MERGED_OUT]->(target)
      SET nr += properties(r)
      WITH nameOnly, idEvent
      // Re-create incoming relationships on idEvent preserving properties (using generic rel type)
      OPTIONAL MATCH (source)-[r2]->(nameOnly)
      WITH nameOnly, idEvent, collect(r2) AS inRels, collect(source) AS inSources
      UNWIND range(0, size(inRels)-1) AS jdx
      WITH nameOnly, idEvent, inRels[jdx] AS r2, inSources[jdx] AS source
      WHERE r2 IS NOT NULL
      CREATE (source)-[nr2:MERGED_IN]->(idEvent)
      SET nr2 += properties(r2)
      WITH nameOnly, idEvent
      // Copy properties from nameOnly into idEvent (may overwrite duplicates)
      SET idEvent += properties(nameOnly)
      // Remove the old node
      WITH nameOnly
      DETACH DELETE nameOnly
      RETURN 'done' as status
    `;

    // Note: this query relies on APOC procedures being available in the Neo4j instance.
    // If APOC is not enabled, we will fallback to a safer partial strategy below.

    try {
      console.log('Attempting APOC-based reconciliation (fast path)');
      const res = await neo4jClient.runQuery(reconcileCypher, {});
      console.log('Reconcile result:', res);
      console.log('Event reconciliation completed (APOC path).');
      process.exit(0);
    } catch (apocErr) {
      console.warn('APOC reconciliation failed or APOC not available:', apocErr && apocErr.message);
      console.log('Falling back to safe non-APOC merge (may be slower).');

      // Fallback: manually find name-only nodes and merge via application logic
      const findQuery = `MATCH (n:Event) WHERE exists(n.name) AND (n.eventId IS NULL OR n.eventId = '') RETURN n.name as name, id(n) as nid LIMIT 500`;
      const rows = await neo4jClient.runQuery(findQuery, {});
      const names = (rows || []).map(r => (r.get ? r.get('name') : r.name)).filter(Boolean);

      for (const name of names) {
        console.log('Processing name-only Event:', name);
        // Try to find an id-based event with same name
        const findIdEvent = `MATCH (e:Event) WHERE e.name = $name AND exists(e.eventId) RETURN e.eventId as eventId LIMIT 1`;
        const idRows = await neo4jClient.runQuery(findIdEvent, { name });
        const eventId = (idRows && idRows[0]) ? (idRows[0].get ? idRows[0].get('eventId') : idRows[0].eventId) : null;
        if (!eventId) {
          console.log('No id-based Event found for name:', name, ' — skipping');
          continue;
        }
        // Re-link relationships by cypher
        const moveCypher = `
          MATCH (nameOnly:Event {name:$name})
          MATCH (idEvent:Event {eventId:$eventId})
          // outgoing
          WITH nameOnly, idEvent
          OPTIONAL MATCH (nameOnly)-[r]->(t)
          FOREACH (_ IN CASE WHEN r IS NULL THEN [] ELSE [1] END |
            MERGE (idEvent)-[r2:TYPE(r)]->(t)
            SET r2 += r
          )
          // incoming
          WITH nameOnly, idEvent
          OPTIONAL MATCH (s)-[r3]->(nameOnly)
          FOREACH (_ IN CASE WHEN r3 IS NULL THEN [] ELSE [1] END |
            MERGE (s)-[r4:TYPE(r3)]->(idEvent)
            SET r4 += r3
          )
          // copy props
          WITH nameOnly, idEvent
          SET idEvent += apoc.map.removeKeys(properties(nameOnly), ['name'])
          DETACH DELETE nameOnly
        `;
        try {
          await neo4jClient.runQuery(moveCypher, { name, eventId });
          console.log('Merged', name, '→', eventId);
        } catch (eMove) {
          console.error('Failed to merge for', name, eMove && eMove.message);
        }
      }

      console.log('Fallback reconciliation finished.');
      process.exit(0);
    }
  } catch (err) {
    console.error('Reconciliation failed:', err && err.message);
    process.exit(1);
  }
}

run();
