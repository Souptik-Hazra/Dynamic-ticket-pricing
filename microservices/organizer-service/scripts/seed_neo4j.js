import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USERNAME || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

async function seed() {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();
  try {
    console.log('Seeding Neo4j at', uri);
    // Create indexes/constraints for Category and Event
    await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE`);
    await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (e:Event) REQUIRE e.name IS UNIQUE`);

    // Create a richer demo graph: Venue -> Event -> Categories and Seats
    const demoCypher = `
      MERGE (v:Venue {name: $venue})
      MERGE (e:Event {name: $event})
      SET e.date = $date
      MERGE (e)-[:HELD_AT]->(v)
      WITH v,e
      CALL {
        WITH e
        UNWIND $categories AS cat
        MERGE (c:Category {name: cat.name})
        SET c.seats = cat.seats, c.price = cat.price
        MERGE (e)-[:HAS_CATEGORY]->(c)
        RETURN COUNT(c) as created
      }
      RETURN v.name AS venue, e.name AS event
    `;

    const params = {
      venue: 'Demo Arena',
      event: 'Demo Concert',
      date: new Date().toISOString(),
      categories: [
        { name: 'General', seats: 1000, price: 45 },
        { name: 'VIP', seats: 100, price: 150 },
        { name: 'Balcony', seats: 300, price: 60 }
      ]
    };

    const result = await session.run(demoCypher, params);
    console.log('Seeded demo graph OK');
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exitCode = 1;
  } finally {
    await session.close();
    await driver.close();
  }
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  seed();
}

export default seed;
