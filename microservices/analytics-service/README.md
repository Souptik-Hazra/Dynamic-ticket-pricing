# Analytics Service

Provides system analytics (total events, tickets sold, revenue).

## Endpoints
- `GET /api/analytics` (JWT required): Get analytics summary.
- `GET /api/health`: Health check.

## Env Vars
- `PORT` (default 4006)
- `MONGO_URI`
- `JWT_SECRET`
