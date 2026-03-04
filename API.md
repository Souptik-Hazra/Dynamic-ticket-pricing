# API Documentation

## Authentication
- `POST /api/auth/signup` – Create user
- `POST /api/auth/signin` – Login
- `GET /api/auth/me` – Get profile
- `POST /api/auth/create-admin` – Create admin

## Events
- `GET /api/events` – List events
- `GET /api/events/:id` – Event details
- `POST /api/events` – Create event
- `PUT /api/events/:id` – Update event
- `DELETE /api/events/:id` – Delete event
- `GET /api/events/:id/price` – ML price prediction

## Admin
- `GET /api/admin/events` – All events
- `POST /api/admin/events` – Create event
- `PUT /api/admin/events/:id` – Update event
- `DELETE /api/admin/events/:id` – Delete event
- `GET /api/admin/stats` – System stats

## Tickets
- `POST /api/tickets` – Purchase tickets
- `GET /api/tickets/user` – User's tickets

## ML API (Port 5000)
- `POST /predict` – Price prediction
- `POST /batch-predict` – Batch predictions
- `GET /health` – API health check

## Other Endpoints
- `/api/subscription` – Manage user subscriptions
- `/api/notifications` – User/admin notifications
- `/api/analytics` – System analytics and reporting
- `/api/mlModel` – ML model metadata, retraining, or status

## WebSocket

### Connection
- URL: `ws://localhost:3001` (or your backend server address)
- Protocol: Standard WebSocket
