# Cache Service

Handles caching using Redis.

## Endpoints
- `POST /api/cache` — Set cache (body: key, value, ttl?)
- `GET /api/cache/:key` — Get cache by key
- `DELETE /api/cache/:key` — Delete cache by key

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
PORT=3006
```
