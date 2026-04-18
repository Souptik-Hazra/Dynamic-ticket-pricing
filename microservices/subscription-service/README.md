# Subscription Service

Handles user subscription plans and upgrades.

## Endpoints
- `POST /api/subscription/upgrade` (JWT required): Upgrade or create a subscription.
- `GET /api/subscription` (JWT required): Get current user's subscription.
- `GET /api/health`: Health check.

## Env Vars
- `PORT` (default 4007)
- `MONGO_URI`
- `JWT_SECRET`
