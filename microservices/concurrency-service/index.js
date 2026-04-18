// Concurrency Service Entry Point
import express from 'express';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Acquire lock
app.post('/api/lock', async (req, res) => {
  const { key, ttl } = req.body;
  const lockKey = `lock:${key}`;
  try {
    const result = await redis.set(lockKey, 'locked', 'NX', 'EX', ttl || 10);
    if (result === 'OK') {
      res.json({ locked: true });
    } else {
      res.status(423).json({ locked: false, error: 'Resource is already locked' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Release lock
app.delete('/api/lock/:key', async (req, res) => {
  const lockKey = `lock:${req.params.key}`;
  try {
    await redis.del(lockKey);
    res.json({ unlocked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'concurrency-service', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4006;
app.listen(PORT, () => {
  console.log(`Concurrency Service running on port ${PORT}`);
});
