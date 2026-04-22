import neo4jClient from '../utils/neo4jClient.js';

(async function clearAll() {
  try {
    console.log('[neo4j-clear] Starting full database clear. This will DETACH DELETE all nodes.');
    const records = await neo4jClient.runQuery('MATCH (n) DETACH DELETE n RETURN count(n) as deleted');
    // Depending on driver behavior, records may be empty; still report success
    console.log('[neo4j-clear] Query executed. Records:', records && records.length);
    await neo4jClient.closeDriver();
    console.log('[neo4j-clear] Completed. All nodes and relationships removed.');
    process.exit(0);
  } catch (err) {
    console.error('[neo4j-clear] Failed to clear database:', err && err.message);
    process.exit(2);
  }
})();
