/**
 * GradientAuditor
 * 
 * Part of the "Decentralized Edge-Cognitive Pricing Governance" (DECPG) system.
 * Detects "Model Poisoning" or "Industrial Sabotage" in Federated Learning updates.
 */

const HISTORICAL_STATS = {
  mean: 1.15,
  stdDev: 0.12
};

/**
 * auditNeuralWeights
 * 
 * Specifically designed to detect "Neural Poisoning" in incoming 
 * Federated Learning weights.
 */
export const auditNeuralWeights = async (weightData) => {
  console.log("🧐 AUDITING NEURAL WEIGHTS FROM EDGE NODE...");
  
  let totalValues = 0;
  let sum = 0;
  let hasInfOrNan = false;

  weightData.forEach(layer => {
    if (layer.data) {
        layer.data.forEach(v => {
            if (!isFinite(v) || isNaN(v)) hasInfOrNan = true;
            sum += Math.abs(v);
            totalValues++;
        });
    }
  });

  const averageMagnitude = totalValues > 0 ? (sum / totalValues) : 0;

  if (hasInfOrNan || averageMagnitude > 10.0) {
    return {
      isValid: false,
      reason: "🚨 NEURAL POISONING DETECTED: Extreme weight magnitudes or non-finite values.",
      threatLevel: "Critical"
    };
  }

  return {
    isValid: true,
    auditTimestamp: new Date().toISOString()
  };
};

/**
 * auditGradientUpdate
 * 
 * Analyzes a new gradient using Statistical Outlier Detection (Z-Score).
 */
export const auditGradientUpdate = async (proposedUpdate) => {
  console.log("🧐 AUDITING FEDERATED GRADIENT:", proposedUpdate);

  const { priceMultiplier } = proposedUpdate;

  // 1. Statistical Anomaly Check (Z-Score)
  const zScore = Math.abs((priceMultiplier - HISTORICAL_STATS.mean) / HISTORICAL_STATS.stdDev);
  
  if (zScore > 3) {
    return {
      isValid: false,
      reason: `🚨 STATISTICAL ANOMALY: Z-Score detected. Possible model poisoning.`,
      threatLevel: "Critical"
    };
  }

  return {
    isValid: true,
    auditTimestamp: new Date().toISOString()
  };
};
