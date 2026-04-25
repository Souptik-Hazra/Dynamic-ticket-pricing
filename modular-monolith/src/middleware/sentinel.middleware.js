import { auditHumanity } from '../modules/ai/ai.service.js';
import { logSecurity } from '../shared/logger.service.js';

/**
 * Sentinel Middleware
 * 
 * Reusable security guards for honeypot detection and behavioral auditing.
 */

export const honeypotGuard = async (req, res, next) => {
  const { username_real } = req.body;

  // 🛡️ Ghost Button / Hidden Input Trap
  if (username_real) {
    const trapType = username_real === 'BOT_TRAP_CLICKED' ? 'Ghost Button' : 'Hidden Input';
    await logSecurity('Sentinel', `Bot signature detected: ${trapType}`, { ip: req.ip, userId: req.user?.id });
    
    // Auto-escalate bot score for this user if authenticated
    if (req.user?.id) {
       await auditHumanity(req.user.id, 'BOT_TRAP_TRIGGERED', { trapType });
    }

    return res.status(403).json({ 
      error: 'SECURITY_PROTOCOL_BREACH', 
      message: 'Automated activity detected. Your reputation has been downgraded.' 
    });
  }

  next();
};

/**
 * neuralAuditGuard
 * 
 * Middleware to enforce behavioral telemetry validation on critical routes.
 */
export const neuralAuditGuard = async (req, res, next) => {
  const { humanityProof, behavioralMetadata } = req.body;
  
  if (!humanityProof) {
    return res.status(403).json({ error: 'MISSING_NEURAL_PROOF', message: 'Behavioral signature required.' });
  }

  const isHuman = await auditHumanity(req.user?.id, humanityProof, behavioralMetadata || {});
  
  if (!isHuman) {
    return res.status(403).json({ 
      error: 'BEHAVIORAL_ANOMALY', 
      message: 'Inconsistent behavioral signature detected.' 
    });
  }

  next();
};
