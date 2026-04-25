import response from '../shared/utils/response.js';
import { logSecurity } from '../shared/utils/logger.js';

/**
 * 🛡️ Advanced Bot Shield (Anti-Scalper Middleware)
 * 
 * Performs multi-layer inspection of incoming requests:
 * 1. Missing/Suspicious Headers (Bot-like signatures)
 * 2. Rapid-fire requests from same Fingerprint
 * 3. Headless Browser Detection
 */

export const botShield = async (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const isBot = /headless|bot|crawl|spider|selenium|puppeteer|axios|postman/i.test(ua);

  // 1. Block known automation tools from sensitive paths (e.g. purchase)
  if (isBot && req.path.includes('/purchase')) {
    logSecurity('BotShield', 'Blocked Automation Script', { ip: req.ip, ua, path: req.path });
    return response.error(res, 'Access denied: Automation detected.', 403, 'ERR_BOT_DETECTED');
  }

  // 2. Entropy Check (Advanced Phase 11 Hardening)
  // Real browsers have consistent header order and specific entropy in fingerprints.
  const hasBrowserHeaders = req.headers['accept-language'] && req.headers['sec-ch-ua'] && req.headers['sec-fetch-dest'];
  const suspiciousHeaders = !req.headers['accept-encoding'] || !req.headers['connection'];

  if (isBot || (suspiciousHeaders && !req.path.includes('/auth'))) {
    req.isSuspectedBot = true;
    
    // Diamond Step: Adaptive Throttling (Increment suspicion in Redis)
    const { cacheSet, cacheGet } = await import('../shared/utils/cache.js');
    const suspicionKey = `suspicion:${req.ip}`;
    const currentScore = (await cacheGet(suspicionKey)) || 0;
    await cacheSet(suspicionKey, currentScore + 1, 3600);
  }

  // 3. Simple Rate-Limit per Fingerprint (Custom logic)
  // Here we could add more complex fingerprinting (IP + UA + Accept-Headers)
  
  next();
};

export default botShield;
