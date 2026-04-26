import { parentPort, workerData } from 'worker_threads';
import crypto from 'crypto';

/**
 * Pure implementation of Proof-of-Work to avoid complex dependency imports in worker
 */
const verifyPoW = (challenge, proof, difficulty = 2000) => {
  let result = challenge;
  for (let i = 0; i < difficulty; i++) {
    result = crypto.createHash('sha256').update(result + i).digest('hex');
  }
  return result === proof;
};

/**
 * Pure implementation of Federated Aggregation logic
 */
const aggregateWeights = (buffer, threshold, clipNorm, dpEpsilon) => {
  const participants = buffer.length;
  let totalReputation = 0;
  const aggMap = new Map();

  // 1. Calculate Norms for outlier detection
  const norms = buffer.map(u => {
    let l2 = 0;
    u.clippedWeights.forEach(l => l.data.forEach(v => l2 += v * v));
    return Math.sqrt(l2);
  });
  
  const meanNorm = norms.reduce((a, b) => a + b, 0) / participants;
  const stdNorm = Math.sqrt(norms.reduce((a, b) => a + Math.pow(b - meanNorm, 2), 0) / participants) || 1;

  // 2. Aggregate weights
  const validParticipants = [];
  const rejectedNodes = [];
  for (let i = 0; i < buffer.length; i++) {
    const update = buffer[i];
    const uL2 = norms[i];
    const zScore = Math.abs(uL2 - meanNorm) / stdNorm;

    if (zScore > 3.0 && participants > 5) {
      rejectedNodes.push({ nodeId: update.nodeId, zScore });
      continue; // Skip outliers
    }

    totalReputation += update.reputationScore;
    validParticipants.push(update.nodeId);


    for (const layer of update.clippedWeights) {
      if (!aggMap.has(layer.name)) {
        aggMap.set(layer.name, { shape: layer.shape, data: new Array(layer.data.length).fill(0) });
      }
      const aggLayer = aggMap.get(layer.name);
      for (let j = 0; j < layer.data.length; j++) {
        aggLayer.data[j] += layer.data[j] * update.reputationScore;
      }
    }
  }

  // 3. Finalize with Differential Privacy noise
  const finalWeights = [];
  let aggL2NormSq = 0;
  for (const [name, layer] of aggMap.entries()) {
    const averagedData = layer.data.map(val => {
      let finalVal = val / totalReputation;
      // Gaussian noise for DP
      const u1 = Math.random();
      const u2 = Math.random();
      const noise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * dpEpsilon;
      finalVal += noise;
      aggL2NormSq += finalVal * finalVal;
      return finalVal;
    });
    finalWeights.push({ name, shape: layer.shape, data: averagedData });
  }

  return {
    finalWeights,
    aggregatedWeightsNorm: Math.sqrt(aggL2NormSq),
    rejectedCount: buffer.length - validParticipants.length,
    validParticipantsCount: validParticipants.length,
    rejectedNodes
  };
};


// Handle Task
const { taskName, payload } = workerData;

try {
  let result;
  switch (taskName) {
    case 'verifyPoW':
      result = verifyPoW(payload.challenge, payload.proof, payload.difficulty);
      break;
    case 'aggregateWeights':
      result = aggregateWeights(payload.buffer, payload.threshold, payload.clipNorm, payload.dpEpsilon);
      break;
    default:
      throw new Error(`Unknown task: ${taskName}`);
  }
  parentPort.postMessage({ data: result });
} catch (err) {
  parentPort.postMessage({ error: err.message });
}
