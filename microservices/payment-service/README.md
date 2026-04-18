# Payment Service

Handles payment creation and retrieval.

## Endpoints
- `POST /api/payments/` — Create payment
- `GET /api/payments/:id` — Get payment by ID
- `GET /api/payments/user/:userId` — List all payments for a user

## Setup
1. Install dependencies:
   ```bash
   npm install express mongoose dotenv
   ```
2. Start MongoDB locally or update `.env` with your MongoDB URI.
3. Run the service:
   ```bash
   npm start
   ```

## .env Example
```
MONGODB_URI=mongodb://localhost:27017/payment_service
PORT=3005
```
