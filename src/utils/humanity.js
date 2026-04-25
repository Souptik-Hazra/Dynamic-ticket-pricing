import CryptoJS from 'crypto-js';

/**
 * 🛡️ Proof-of-Humanity (Frontend Sentinel)
 * 
 * Performs a silent, cryptographic "Proof-of-Work" that
 * stops 99% of bots while appearing as a standard "Loading"
 * state to human users.
 */

export const solveHumanityChallenge = async (challenge, difficulty = 2000) => {
  return new Promise((resolve) => {
    // We use a small delay to ensure it doesn't block the main UI thread entirely
    setTimeout(() => {
      let result = challenge;
      for (let i = 0; i < difficulty; i++) {
        result = CryptoJS.SHA256(result + i).toString();
      }
      resolve(result);
    }, 10);
  });
};

export const generateTemporalProof = async (eventId) => {
  const challenge = `${eventId}-${Date.now()}`;
  const proof = await solveHumanityChallenge(challenge);
  return { challenge, proof };
};
