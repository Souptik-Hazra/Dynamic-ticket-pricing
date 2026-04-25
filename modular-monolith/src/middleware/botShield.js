/**
 * 🛡️ ELITE BOT SHIELD
 * Unified Monolith Security Layer
 */

const BOT_USER_AGENTS = [
    'axios', 'node-fetch', 'python-requests', 'headless', 'phantomjs', 'selenium', 
    'webdriver', 'puppeteer', 'got', 'curl', 'wget', 'postman'
];

const requestHistory = new Map(); // IP -> { lastHit: timestamp, count: number }

export const botShield = (req, res, next) => {
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const userIp = req.headers['x-forwarded-for'] || req.ip;

    // 1. Signature Check
    const isBotUA = BOT_USER_AGENTS.some(bot => userAgent.includes(bot));
    if (isBotUA) {
        console.warn(`[BotShield] 🚩 BLOCKED suspicious User-Agent from ${userIp}: ${userAgent}`);
        return res.status(403).json({ 
            error: 'SECURITY_VIOLATION', 
            message: 'Automated access is restricted. Please use a supported browser.' 
        });
    }

    // 2. Burst Frequency Check (Global)
    const now = Date.now();
    let history = requestHistory.get(userIp) || { lastHit: now, count: 0 };
    
    // Reset window every 10 seconds
    if (now - history.lastHit > 10000) {
        history = { lastHit: now, count: 1 };
    } else {
        history.count++;
        // Tighter threshold for production parity
        if (history.count > 20) {
            console.warn(`[BotShield] 🚩 THROTTLED burst traffic from ${userIp}`);
            return res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Slow down. Too many requests detected.' });
        }
    }
    requestHistory.set(userIp, history);

    // 3. Behavioral Scoring (Add header for module intelligence)
    // Other modules can use this to enforce harder checks
    let botScore = 0;
    if (!req.headers['user-agent']) botScore += 50;
    if (req.headers['accept'] === '*/*') botScore += 20;
    
    req.headers['x-bot-score'] = botScore;
    next();
};

// Cleanup history every hour to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requestHistory.entries()) {
        if (now - data.lastHit > 60000) requestHistory.delete(ip);
    }
}, 60000);
