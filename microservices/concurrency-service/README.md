# Concurrency Service

Handles distributed locking using Redis.

## Endpoints
- `POST /api/lock` — Acquire lock (body: key, ttl?)
- `DELETE /api/lock/:key` — Release lock

## Setup
1. Install dependencies:
   ```bash
   npm install express ioredis dotenv
   ```
2. Start Redis locally or update `.env` with your Redis URL.
3. Run the service:
   ```bash
   npm start
   ```

## .env Example
```
REDIS_URL=redis://localhost:6379
PORT=3007
```
