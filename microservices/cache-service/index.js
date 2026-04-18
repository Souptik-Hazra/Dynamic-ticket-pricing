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

// ── In-Memory Fallback (Dev Mode) ─────────────────────────────────────────
const localStore = new Map(); // { key: { value: string, expires: number | null } }
const localLocks = new Map(); // { key: { token: string, expires: number } }

// ── Middleware: Log Redis Status (Replaces former 503 block) ────────────────
const checkRedisStatus = (_req, res, next) => {
  if (!redisReady) {
    console.warn('[Cache] REDIS OFFLINE: Using temporary In-Memory Fallback');
  }
  next();
};

// ── Cleanup Helper: Remove expired local entries ────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of localStore) {
    if (data.expires && now > data.expires) localStore.delete(key);
  }
  for (const [key, data] of localLocks) {
    if (now > data.expires) localLocks.delete(key);
  }
}, 10000);

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
app.post('/api/cache', checkRedisStatus, async (req, res, next) => {
  try {
    const { key, value, ttl } = req.body;
    if (!validateKey(key, res)) return;
    if (value === undefined) return res.status(400).json({ error: 'value is required' });

    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const ttlSeconds = ttl ? parseInt(ttl) : null;

    if (redisReady) {
      if (ttlSeconds) {
        await redis.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await redis.set(key, serialized);
      }
    } else {
      // Fallback
      localStore.set(key, {
        value: serialized,
        expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      });
    }

    res.json({ message: 'Cached successfully', key, fallback: !redisReady });
  } catch (err) { next(err); }
});

// ── GET ───────────────────────────────────────────────────────────────────
app.get('/api/cache/:key', checkRedisStatus, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!validateKey(key, res)) return;

    let raw = null;
    if (redisReady) {
      raw = await redis.get(key);
    } else {
      const data = localStore.get(key);
      if (data) {
        if (data.expires && Date.now() > data.expires) {
          localStore.delete(key);
        } else {
          raw = data.value;
        }
      }
    }

    if (raw === null) return res.status(404).json({ error: `Key '${key}' not found` });

    // Try to parse JSON, fall back to raw string
    let value;
    try { value = JSON.parse(raw); } catch { value = raw; }

    res.json({ key, value, fallback: !redisReady });
  } catch (err) { next(err); }
});

// ── DELETE BY PATTERN (Wildcard) ──────────────────────────────────────────
// Efficiently deletes multiple keys using SCAN
app.delete('/api/cache/pattern/:pattern', checkRedisStatus, async (req, res, next) => {
  try {
    const { pattern } = req.params;
    if (!validateKey(pattern, res)) return;

    let count = 0;
    if (redisReady) {
      const stream = redis.scanStream({ match: pattern, count: 100 });
      for await (const resultKeys of stream) {
        if (resultKeys.length > 0) count += await redis.del(...resultKeys);
      }
    } else {
      // Basic regex fallback for local pattern delete
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      for (const key of localStore.keys()) {
        if (regex.test(key)) {
          localStore.delete(key);
          count++;
        }
      }
    }

    console.log(`[Cache] Cleared pattern '${pattern}' — ${count} keys removed`);
    res.json({ message: `Pattern '${pattern}' cleared`, keysDeleted: count, fallback: !redisReady });
  } catch (err) { next(err); }
});

// ── DELETE ────────────────────────────────────────────────────────────────
app.delete('/api/cache/:key', checkRedisStatus, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (!validateKey(key, res)) return;

    let deleted = 0;
    if (redisReady) {
      deleted = await redis.del(key);
    } else {
      deleted = localStore.delete(key) ? 1 : 0;
    }

    if (deleted === 0) return res.status(404).json({ error: `Key '${key}' not found` });
    res.json({ message: `Key '${key}' deleted`, fallback: !redisReady });
  } catch (err) { next(err); }
});

// ── TTL check ─────────────────────────────────────────────────────────────
app.get('/api/cache/:key/ttl', checkRedisStatus, async (req, res, next) => {
  try {
    const { key } = req.params;
    if (redisReady) {
      const ttl = await redis.ttl(key);
      if (ttl === -2) return res.status(404).json({ error: 'Key does not exist' });
      res.json({ key, ttl, persistent: ttl === -1 });
    } else {
      const data = localStore.get(key);
      if (!data) return res.status(404).json({ error: 'Key does not exist' });
      const ttl = data.expires ? Math.max(0, Math.floor((data.expires - Date.now()) / 1000)) : -1;
      res.json({ key, ttl, persistent: ttl === -1, fallback: true });
    }
  } catch (err) { next(err); }
});

// ── LOCKING ───────────────────────────────────────────────────────────────
/**
 * Atomic lock acquisition. 
 * Returns { success: true, token } if acquired, or { success: false } if held.
 */
app.post('/api/cache/lock', checkRedisStatus, async (req, res, next) => {
  try {
    const { key, ttl = 5000 } = req.body;
    if (!validateKey(key, res)) return;

    const token = Math.random().toString(36).substring(2, 15);

    if (redisReady) {
      const result = await redis.set(key, token, 'NX', 'PX', ttl);
      if (result === 'OK') {
        return res.json({ success: true, token, message: `Lock acquired on ${key}` });
      }
    } else {
      // Local Lock Fallback
      const now = Date.now();
      const existing = localLocks.get(key);
      if (!existing || now > existing.expires) {
        localLocks.set(key, { token, expires: now + ttl });
        return res.json({ success: true, token, message: `Local lock acquired on ${key}`, fallback: true });
      }
    }

    res.json({ success: false, message: `Lock ${key} is already held` });
  } catch (err) { next(err); }
});

/**
 * Atomic unlock. Only deletes if the value matching the token.
 */
app.post('/api/cache/unlock', checkRedisStatus, async (req, res, next) => {
  try {
    const { key, token } = req.body;
    if (!validateKey(key, res)) return;
    if (!token) return res.status(400).json({ error: 'token is required to unlock' });

    if (redisReady) {
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await redis.eval(luaScript, 1, key, token);
      if (result === 1) return res.json({ success: true, message: `Lock ${key} released` });
    } else {
      // Local Unlock Fallback
      const existing = localLocks.get(key);
      if (existing && existing.token === token) {
        localLocks.delete(key);
        return res.json({ success: true, message: `Local lock ${key} released`, fallback: true });
      }
    }

    res.status(400).json({ success: false, message: `Failed to release lock ${key} (invalid token or expired)` });
  } catch (err) { next(err); }
});

// ── 404 + Error handlers ──────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT_CACHE_SERVICE || process.env.PORT || 4005;
const server = app.listen(PORT, () => console.log(`Cache Service running on port ${PORT}`));
registerProcessHandlers(server, 'CacheService');
