#!/usr/bin/env node
// neo4j_setup.mjs
// Creates useful indexes/constraints for organizer-service Neo4j schema

import neo4jClient from '../utils/neo4jClient.js';

async function run() {
  try {
    console.log('Connecting to Neo4j and creating constraints/indexes...');

    const queries = [
      "CREATE CONSTRAINT IF NOT EXISTS FOR (s:Seat) REQUIRE s.id IS UNIQUE",
      "CREATE CONSTRAINT IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE",
      "CREATE CONSTRAINT IF NOT EXISTS FOR (e:Event) REQUIRE e.eventId IS UNIQUE",
      "CREATE INDEX IF NOT EXISTS FOR (s:Seat) ON (s.lastUpdated)",
      "CREATE INDEX IF NOT EXISTS FOR (s:Seat) ON (s.id)",
      "CREATE INDEX IF NOT EXISTS FOR (c:Category) ON (c.name)"
    ];

    for (const q of queries) {
      console.log('Running:', q);
      await neo4jClient.runQuery(q, {});
      console.log('OK');
    }

    console.log('Neo4j setup completed.');
    process.exit(0);
  } catch (err) {
    console.error('Neo4j setup failed:', err && err.message);
    process.exit(1);
  }
}

run();
