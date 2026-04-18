# Notification Service

Handles sending and listing notifications (demo: in-memory store).

## Endpoints
- `POST /api/notifications` — Send notification (body: to, type, message)
- `GET /api/notifications` — List all notifications

## Setup
1. Install dependencies:
   ```bash
   npm install express dotenv
   ```
2. Run the service:
   ```bash
   npm start
   ```

## .env Example
```
PORT=3010
```
