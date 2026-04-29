import crypto from 'crypto';
import workerManager from '../../../shared/utils/worker.manager.js';

/**
 * 🛡️ Security Service
 * 
 * Handles Proof-of-Work (PoW) and other cryptographic security checks.
 */

export const verifyTemporalProof = async (challenge, proof, difficulty = 2000) => {
  // For very low difficulty, keep it sync to avoid worker overhead
  if (difficulty < 500) {
    let result = challenge;
    for (let i = 0; i < difficulty; i++) {
      result = crypto.createHash('sha256').update(result + i).digest('hex');
    }
    return result === proof;
  }

  // Offload to worker thread for high difficulty
  return await workerManager.runTask('verifyPoW', { challenge, proof, difficulty });
};

export default { verifyTemporalProof };
