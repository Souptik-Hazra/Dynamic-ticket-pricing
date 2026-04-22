import neo4jClient from '../utils/neo4jClient.js';

const cypherQuery = `
  UNWIND $categories AS cat
  WITH cat,
    CASE
      WHEN $layoutType = 'stadium' THEN 20
      WHEN $layoutType = 'arena' THEN 15
      WHEN $layoutType = 'festival' THEN 30
      WHEN $layoutType = 'theater' THEN 10
      ELSE 5
    END AS topologyBase,
    CASE
      WHEN $metrics.exitsCount <= 2 THEN 30
      WHEN $metrics.exitsCount <= 4 THEN 10
      WHEN $metrics.exitsCount >= 10 THEN -15
      ELSE 0
    END AS exitPenalty,
    CASE WHEN $metrics.aisleWidth = 'narrow' THEN 25 WHEN $metrics.aisleWidth = 'wide' THEN -10 ELSE 0 END AS aislePenalty,
    CASE WHEN $metrics.securitySpeed = 'slow' THEN 15 WHEN $metrics.securitySpeed = 'fast' THEN -5 ELSE 0 END AS speedPenalty

  WITH cat.name AS name, (20 + topologyBase + exitPenalty + aislePenalty + speedPenalty) AS rawRisk
  RETURN name, CASE WHEN rawRisk > 100 THEN 100 WHEN rawRisk < 0 THEN 0 ELSE rawRisk END AS riskScore
`;

const params = {
  categories: [{ name: 'General', seats: 100 }],
  layoutType: 'arena',
  metrics: { exitsCount: 3, aisleWidth: 'standard', securitySpeed: 'normal' }
};

(async () => {
  try {
    const records = await neo4jClient.runQuery(cypherQuery, params);
    console.log('Test runQuery returned records count:', Array.isArray(records) ? records.length : typeof records);
    if (Array.isArray(records)) {
      records.forEach(r => console.log('record keys:', r.keys));
    }
  } catch (err) {
    console.error('runQuery failed with error:');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
  process.exit();
})();
