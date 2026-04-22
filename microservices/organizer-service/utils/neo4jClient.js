import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

// Placeholder handling: if no real URI is provided, we catch it but do not crash the container.
const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
const user = process.env.NEO4J_USERNAME || "neo4j";
const password = process.env.NEO4J_PASSWORD || "password";

let driver; // Initialize the Neo4j driver

// Controlled debug logging — enable by setting NEO4J_DEBUG=true in environment
const NEO4J_DEBUG = (process.env.NEO4J_DEBUG || '').toLowerCase() === 'true';
const debug = (...args) => { if (NEO4J_DEBUG) console.log('[Neo4j DEBUG]', ...args); };
const debugError = (...args) => { if (NEO4J_DEBUG) console.error('[Neo4j DEBUG]', ...args); };

try {
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  debug('Neo4j Driver initialized (waiting for query executions)');
  debug('Neo4j client using URI:', uri);
} catch (error) {
  debugError('Failed to initialize Neo4j driver:', error && error.message);
  driver = null;
}

/**
 * Execute a Cypher query on the Neo4j instance.
 * @param {string} cypherQuery
 * @param {object} params
 */
const runQuery = async (cypherQuery, params = {}) => {
  if (!driver || uri.includes('placeholder')) {
    // If the user hasn't configured Neo4j Aura properly, we return a fallback stub.
    console.warn('[Neo4j-Fallback] Graph DB not configured perfectly. Using heuristic stub.');
    throw new Error('NEO4J_NOT_CONFIGURED');
  }

  // Log queries only when debugging is explicitly enabled to avoid leaking sensitive info.
  debug('Running query (truncated):', (cypherQuery || '').toString().slice(0, 200));
  debug('Params:', JSON.stringify(params));

  const session = driver.session();
  try {
    const result = await session.run(cypherQuery, params);
    return result.records;
  } catch (error) {
    debugError('Cypher Error:', error && error.message, error && error.stack ? error.stack : error);
    throw error;
  } finally {
    await session.close();
  }
};

const closeDriver = async () => {
  if (driver) {
    await driver.close();
  }
};

export default {
  driver,
  runQuery,
  closeDriver
};
