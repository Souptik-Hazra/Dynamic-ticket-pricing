/**
 * PricingAudit
 * 
 * Part of the "Decentralized Decision Logging" component of DECPG.
 * Generates an auditable hash of a pricing decision for the blockchain.
 */
export const generatePricingAuditHash = async (decisionData) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(decisionData) + Date.now());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

import api from '../api/client';

/**
 * logPricingDecision
 * 
 * Logs the decision to the monolithic permanent ledger for auditability.
 */
export const logPricingDecision = async (decision) => {
  const hash = await generatePricingAuditHash(decision);
  
  try {
    await api.post('/ai/log-decision', {
      ...decision,
      hash
    });
    console.log("📜 PRICING AUDIT LOGGED TO SERVER:", hash);
  } catch (err) {
    console.error("❌ FAILED TO LOG PRICING AUDIT:", err.message);
  }
  
  return hash;
};
