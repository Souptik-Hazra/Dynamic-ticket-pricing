# Message Queue Service

Handles message publishing and consuming using RabbitMQ.

## Endpoints
- `POST /api/queue/publish` — Publish message (body: message)
- `GET /api/queue/consume` — Consume message (demo only)

## Setup
1. Install dependencies:
   ```bash
   npm install express amqplib dotenv
   ```
2. Start RabbitMQ locally or update `.env` with your RabbitMQ URL.
3. Run the service:
   ```bash
   npm start
   ```

## .env Example
```
RABBITMQ_URL=amqp://localhost
PORT=3009
```
