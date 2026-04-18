import express from 'express';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import cors from 'cors';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import { registerProcessHandlers } from '../shared/db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Redis client with graceful degradation ────────────────────────────────
// lazyConnect:true  → does NOT throw on startup if Redis is offline
// retryStrategy    → exponential backoff, gives up after 10 attempts
let redisReady = false;

const redis = new Redis({
  host:         process.env.REDIS_HOST || '127.0.0.1',
  port:         parseInt(process.env.REDIS_PORT || '6379'),
  password:     process.env.REDIS_PASSWORD || undefined,
  lazyConnect:  true,
  retryStrategy: (times) => {
    if (times > 10) {
      console.error('[Cache] Redis: max retries reached, giving up');
      return null; // stop retrying
    }
    const delay = Math.min(times * 200, 3000);
    console.warn(`[Cache] Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
});

redis.on('connect',      ()    => { redisReady = true;  console.log('[Cache] Redis connected'); });
redis.on('ready',        ()    => { redisReady = true; });
redis.on('close',        ()    => { redisReady = false; console.warn('[Cache] Redis connection closed'); });
redis.on('reconnecting', ()    => { redisReady = false; });
redis.on('error',        (err) => {
  redisReady = false;
  // Suppress ECONNREFUSED noise — retryStrategy already logs it
  if (err.code !== 'ECONNREFUSED') console.error('[Cache] Redis error:', err.message);
});

// Attempt initial connection (non-blocking)
redis.connect().catch((err) => {
  console.warn('[Cache] Redis unavailable at startup:', err.message);
});

// ── Middleware: require Redis ─────────────────────────────────────────────
const requireRedis = (_req, res, next) => {
  if (!redisReady) return res.status(503).json({ error: 'Cache service unavailable (Redis offline)' });
  next();
};

// ── Validation helper ─────────────────────────────────────────────────────
const validateKey = (key, res) => {
  if (!key || typeof key !== 'string' || key.trim() === '') {
    res.status(400).json({ error: 'key must be a non-empty string' });
    return false;
  }
  return true;
};

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({
    status:     'ok',
    service:    'cache-service',
    redisReady,
    ts:         new Date().toISOString(),
  })
);

// ── SET ───────────────────────────────────────────────────────────────────
app.post('/api/cache', requireRedis, async (req, res, next) => {
  try {
    const { key, value, ttl } = req.body;
    if (!validateKey(key, res)) return;
    if (value === undefined) return res.status(400).json({ error: 'value is required' });

    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);

    if (ttl) {
      const ttlSeconds = parseInt(ttl);
      if (isNaN(ttlSeconds) || ttlSeconds <= 0)
        return res.status(400).json({ error: 'ttl must be a positive integer (seconds)' });
      await redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await redis.set(key, serialized);
    }

    res.json({ message: 'Cached successfully', key });
  } catch (err) { next(err); }
});

// ── GET ───────────────────────────────────────────────────────────────────
app.get('/api/cache/:key', requireRedis, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!validateKey(key, res)) return;

    const raw = await redis.get(key);
    if (raw === null) return res.status(404).json({ error: `Key '${key}' not found` });

    // Try to parse JSON, fall back to raw string
    let value;
    try { value = JSON.parse(raw); } catch { value = raw; }

    res.json({ key, value });
  } catch (err) { next(err); }
});

// ── DELETE BY PATTERN (Wildcard) ──────────────────────────────────────────
// Efficiently deletes multiple keys using SCAN
app.delete('/api/cache/pattern/:pattern', requireRedis, async (req, res, next) => {
  try {
    const { pattern } = req.params;
    if (!validateKey(pattern, res)) return;

    let count = 0;
    const stream = redis.scanStream({ match: pattern, count: 100 });

    for await (const resultKeys of stream) {
      if (resultKeys.length > 0) {
        count += await redis.del(...resultKeys);
      }
    }

    console.log(`[Cache] Cleared pattern '${pattern}' — ${count} keys removed`);
    res.json({ message: `Pattern '${pattern}' cleared`, keysDeleted: count });
  } catch (err) { next(err); }
});

// ── DELETE ────────────────────────────────────────────────────────────────
app.delete('/api/cache/:key', requireRedis, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!validateKey(key, res)) return;
    const deleted = await redis.del(key);
    if (deleted === 0) return res.status(404).json({ error: `Key '${key}' not found` });
    res.json({ message: `Key '${key}' deleted` });
  } catch (err) { next(err); }
});

// ── TTL check ─────────────────────────────────────────────────────────────
app.get('/api/cache/:key/ttl', requireRedis, async (req, res, next) => {
  try {
    const ttl = await redis.ttl(req.params.key);
    if (ttl === -2) return res.status(404).json({ error: 'Key does not exist' });
    res.json({ key: req.params.key, ttl, persistent: ttl === -1 });
  } catch (err) { next(err); }
});

// ── 404 + Error handlers ──────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT_CACHE_SERVICE || process.env.PORT || 4005;
const server = app.listen(PORT, () => console.log(`Cache Service running on port ${PORT}`));
registerProcessHandlers(server, 'CacheService');
