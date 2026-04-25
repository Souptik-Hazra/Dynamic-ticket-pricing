import { logSecurity } from '../shared/logger.service.js';

/**
 * 🛡️ ELITE BOT SHIELD
 * Refactored Security Layer with Persistent Logging & Async Reliability
 */

const BOT_USER_AGENTS = [
    'axios', 'node-fetch', 'python-requests', 'headless', 'phantomjs', 'selenium', 
    'webdriver', 'puppeteer', 'got', 'curl', 'wget', 'postman'
];

const requestHistory = new Map(); // IP -> { lastHit: timestamp, count: number }

export const botShield = async (req, res, next) => {
    try {
        const userAgent = (req.headers['user-agent'] || '').toLowerCase();
        const userIp = req.headers['x-forwarded-for'] || req.ip;

        // 1. Signature Check
        const isBotUA = BOT_USER_AGENTS.some(bot => userAgent.includes(bot));
        if (isBotUA) {
            await logSecurity('BotShield', `Blocked UA: ${userAgent}`, { ip: userIp });
            return res.status(403).json({ 
                error: 'SECURITY_VIOLATION', 
                message: 'Automated access restricted.' 
            });
        }

        // 2. Burst Frequency Check
        const now = Date.now();
        let history = requestHistory.get(userIp) || { lastHit: now, count: 0 };
        
        if (now - history.lastHit > 10000) {
            history = { lastHit: now, count: 1 };
        } else {
            history.count++;
            if (history.count > 30) {
                await logSecurity('BotShield', `Throttled IP: ${userIp}`, { count: history.count });
                return res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Traffic burst detected.' });
            }
        }
        requestHistory.set(userIp, history);

        // 3. Behavioral Pre-Scoring
        let botScore = 0;
        if (!req.headers['user-agent']) botScore += 50;
        if (req.headers['accept'] === '*/*') botScore += 20;
        if (req.headers['connection'] !== 'keep-alive') botScore += 10;
        
        req.botScore = botScore;

        // 4. Reputation Threshold Blocking
        if (botScore >= 70) {
            await logSecurity('BotShield', `High Bot Score Blocked: ${botScore}`, { ip: userIp, path: req.path });
            return res.status(403).json({ 
                error: 'REPUTATION_BLOCKED', 
                message: 'Request signature suspicious. Please use a standard browser.' 
            });
        }

        next();
    } catch (err) {
        // Fallback: If security logic fails, allow request but log the internal error
        console.error(`[BotShield] Internal Error: ${err.message}`);
        next(); 
    }
};

// Cleanup history every minute
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requestHistory.entries()) {
        if (now - data.lastHit > 60000) requestHistory.delete(ip);
    }
}, 60000);
