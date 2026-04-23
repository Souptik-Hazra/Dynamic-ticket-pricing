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

/**
 * logPricingDecision
 * 
 * Simulates logging the decision to a decentralized ledger.
 */
export const logPricingDecision = async (decision) => {
  const hash = await generatePricingAuditHash(decision);
  console.log("📜 PRICING AUDIT LOGGED:", {
    hash,
    timestamp: new Date().toISOString(),
    decision
  });
  return hash;
};
