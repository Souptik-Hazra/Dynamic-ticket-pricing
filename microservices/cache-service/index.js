// Cache Service Entry Point
import express from 'express';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Set cache
app.post('/api/cache', async (req, res) => {
  const { key, value, ttl } = req.body;
  try {
    if (ttl) {
      await redis.set(key, value, 'EX', ttl);
    } else {
      await redis.set(key, value);
    }
    res.json({ message: 'Cached successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cache
app.get('/api/cache/:key', async (req, res) => {
  try {
    const value = await redis.get(req.params.key);
    if (value === null) return res.status(404).json({ error: 'Key not found' });
    res.json({ key: req.params.key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete cache
app.delete('/api/cache/:key', async (req, res) => {
  try {
    await redis.del(req.params.key);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'cache-service', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4005;
app.listen(PORT, () => {
  console.log(`Cache Service running on port ${PORT}`);
});
