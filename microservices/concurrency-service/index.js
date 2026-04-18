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

// ── Redis client ──────────────────────────────────────────────────────────
let redisReady = false;

const redis = new Redis({
  host:        process.env.REDIS_HOST || '127.0.0.1',
  port:        parseInt(process.env.REDIS_PORT || '6379'),
  password:    process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 10) { console.error('[Concurrency] Redis: max retries reached'); return null; }
    const delay = Math.min(times * 200, 3000);
    console.warn(`[Concurrency] Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  commandTimeout: 3000, // individual command timeout to avoid hanging
});

redis.on('ready',        ()    => { redisReady = true;  console.log('[Concurrency] Redis connected'); });
redis.on('close',        ()    => { redisReady = false; console.warn('[Concurrency] Redis disconnected'); });
redis.on('reconnecting', ()    => { redisReady = false; });
redis.on('error',        (err) => {
  redisReady = false;
  if (err.code !== 'ECONNREFUSED') console.error('[Concurrency] Redis error:', err.message);
});

redis.connect().catch((err) => console.warn('[Concurrency] Redis unavailable at startup:', err.message));

// ── Middleware: require Redis ─────────────────────────────────────────────
const requireRedis = (_req, res, next) => {
  if (!redisReady) return res.status(503).json({ error: 'Concurrency service unavailable (Redis offline)' });
  next();
};

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'concurrency-service', redisReady, ts: new Date().toISOString() })
);

// ── POST /api/lock — acquire distributed lock ─────────────────────────────
// Uses Redis SET NX EX (atomic — prevents race conditions)
app.post('/api/lock', requireRedis, async (req, res, next) => {
  try {
    const { key, ttl } = req.body;
    if (!key || typeof key !== 'string' || key.trim() === '')
      return res.status(400).json({ error: 'key must be a non-empty string' });

    const ttlSeconds = parseInt(ttl) || 10;
    if (ttlSeconds <= 0 || ttlSeconds > 300)
      return res.status(400).json({ error: 'ttl must be between 1 and 300 seconds' });

    const lockKey = `lock:${key}`;
    // SET NX EX is atomic — only one request wins
    const result = await redis.set(lockKey, Date.now().toString(), 'NX', 'EX', ttlSeconds);

    if (result === 'OK') {
      res.json({ locked: true, key, ttl: ttlSeconds });
    } else {
      // 423 Locked — standard HTTP status for "resource is locked"
      res.status(423).json({ locked: false, error: `Resource '${key}' is already locked` });
    }
  } catch (err) { next(err); }
});

// ── DELETE /api/lock/:key — release lock ──────────────────────────────────
app.delete('/api/lock/:key', requireRedis, async (req, res, next) => {
  try {
    const lockKey = `lock:${req.params.key}`;
    const deleted = await redis.del(lockKey);
    if (deleted === 0) return res.status(404).json({ error: 'Lock not found or already released' });
    res.json({ unlocked: true, key: req.params.key });
  } catch (err) { next(err); }
});

// ── GET /api/lock/:key — check lock status ────────────────────────────────
app.get('/api/lock/:key', requireRedis, async (req, res, next) => {
  try {
    const lockKey = `lock:${req.params.key}`;
    const [value, ttl] = await Promise.all([redis.get(lockKey), redis.ttl(lockKey)]);
    res.json({ key: req.params.key, locked: value !== null, ttlRemaining: ttl });
  } catch (err) { next(err); }
});

// ── 404 + Error handlers ──────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT_CONCURRENCY_SERVICE || process.env.PORT || 4006;
const server = app.listen(PORT, () => console.log(`Concurrency Service running on port ${PORT}`));
registerProcessHandlers(server, 'ConcurrencyService');
