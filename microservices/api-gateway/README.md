# API Gateway

Central entry point for all microservices. Proxies requests to the correct backend service.

## Endpoints
- `/api/auth/*` → Authentication Service
- `/api/users/*` → User Service
- `/api/events/*` → User Service
- `/api/tickets/*` → Ticket Service
- `/api/admin/*` → Admin Service
- `/api/payment/*` → Payment Service
- `/api/analytics/*` → Analytics Service
- `/api/subscription/*` → Subscription Service
- `/api/ml-model/*` → ML Model Service
- `/api/health` → Gateway health check

## Env Vars
- `PORT` (default 3001)
- `*_SERVICE_URL` for each microservice

## Usage
1. Install dependencies: `npm install`
2. Start: `npm start`
3. Point frontend `API_URL` to `http://localhost:3001/api`
