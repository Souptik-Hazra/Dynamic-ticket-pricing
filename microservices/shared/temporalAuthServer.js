import crypto from 'crypto';

/**
 * verifyTemporalProof
 * 
 * Verifies that the client actually performed the sequential hashing work.
 * Difficulty must match the system's required temporal speed-bump.
 */
export const verifyTemporalProof = (challenge, proof, difficulty = 2000) => {
  let result = challenge;

  // In a real high-performance VDF, verification would be O(1).
  // For this prototype/speed-bump, we re-verify the chain.
  // Note: This is CPU-intensive on the server if many requests come in, 
  // which actually acts as a natural rate-limiter (back-pressure).
  
  for (let i = 0; i < difficulty; i++) {
    result = crypto.createHash('sha256').update(result + i).digest('hex');
  }

  return result === proof;
};
