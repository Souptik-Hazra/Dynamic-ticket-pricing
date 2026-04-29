import response from '../shared/utils/response.js';
import { logSecurity } from '../shared/utils/logger.js';
import { getRedisClient } from '../shared/utils/cache.js';

const redis = getRedisClient();

/**
 * 🛡️ Advanced Bot Shield (Anti-Scalper Middleware)
 */
export const botShield = async (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const isAutomation = /headless|bot|crawl|spider|selenium|puppeteer|axios|postman/i.test(ua);

  // 1. Path-based critical protection
  if (isAutomation && req.path.includes('/purchase')) {
    logSecurity('BotShield', 'Blocked Automation Script on Purchase', { ip: req.ip, ua });
    return response.error(res, 'Access denied: Automation detected.', 403, 'ERR_BOT_DETECTED');
  }

  // 2. Multi-Layer Header Analysis
  const hasBrowserHeaders = req.headers['accept-language'] && req.headers['sec-ch-ua'];
  const isSuspicious = !ua || !hasBrowserHeaders || isAutomation;

  if (isSuspicious) {
    req.isSuspectedBot = true;
    
    // Persistent Suspicion Score in Redis
    if (redis) {
      const suspicionKey = `suspicion:${req.ip}`;
      try {
        const score = await redis.incr(suspicionKey);
        if (score === 1) await redis.expire(suspicionKey, 3600); // 1 hour TTL
        
        req.suspicionScore = score;
        
        // Critical block for extreme offenders
        if (score > 50) {
          logSecurity('BotShield', 'IP Banned (Suspicion Overflow)', { ip: req.ip, score });
          return response.error(res, 'Too many suspicious requests.', 429, 'ERR_IP_SUSPENDED');
        }
      } catch (err) {
        // Fallback if Redis fails
      }
    }
  }

  next();
};

export default botShield;

