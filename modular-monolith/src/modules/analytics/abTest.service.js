import { cacheGet, cacheSet } from '../../shared/utils/cache.js';

/**
 * 🏆 A/B Pricing Tournament Service
 * 
 * Allows running multiple pricing models simultaneously.
 * Automatically tracks performance and can "promote" the winner.
 */

export const getExperimentSegment = (userId) => {
  // Simple deterministic hash for segmenting users
  const lastChar = String(userId).slice(-1);
  return (parseInt(lastChar, 16) % 2 === 0) ? 'A' : 'B';
};

export const getActiveExperiments = async () => {
  const cached = await cacheGet('pricing:experiments');
  return cached || {
    enabled: true,
    modelA: 'stable_v1',
    modelB: 'experimental_fomo_v2',
    splitRatio: 0.9 // 90% on A, 10% on B
  };
};

export const logExperimentResult = async (userId, experimentId, modelUsed, revenue, surplus) => {
  const statsKey = `stats:experiment:${experimentId}:${modelUsed}`;
  const current = await cacheGet(statsKey) || { revenue: 0, surplus: 0, count: 0 };
  
  current.revenue += revenue;
  current.surplus += surplus;
  current.count += 1;
  
  await cacheSet(statsKey, current, 86400); // 1 day window
};

export default { getExperimentSegment, getActiveExperiments, logExperimentResult };
