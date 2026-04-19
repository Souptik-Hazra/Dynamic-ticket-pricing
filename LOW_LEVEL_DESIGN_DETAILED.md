# Low Level Design (LLD) – Dynamic Ticket Pricing System

## 1. Introduction
This Low Level Design (LLD) document provides a detailed, industry-standard blueprint for the Dynamic Ticket Pricing System. It covers service responsibilities, API contracts, data models, error handling, security, deployment, and extensibility, ensuring maintainability and scalability.

---

## 2. Microservices Architecture

### 2.1 Service Responsibilities
| Service                | Responsibilities                                                                                 |
|------------------------|-------------------------------------------------------------------------------------------------|
| API Gateway            | Routing, authentication, rate limiting, CORS, request logging                                     |
| Admin Service          | Admin dashboard, event management, fraud analytics, reporting                                     |
| Authentication Service | User registration, login, JWT issuance/refresh, password reset                                    |
| User Service           | User profile, order history, user CRUD                                                            |
| Organizer Service      | Event creation, management, organizer dashboard                                                   |
| Payment Service        | Payment initiation, callback handling, integration with Stripe/PayPal, transaction logging        |
| Cache Service          | Redis-based caching, distributed locks, atomic inventory, session management                      |
| Email Service          | Transactional emails, SMTP/third-party integration                                                |
| Notification Service   | In-app and push notifications, notification preferences                                           |
| WebSocket Service      | Real-time updates (ticket sold, price change), client subscriptions                               |
| QR Service             | QR code generation, validation, ticket check-in                                                   |
| Scanner Service        | Ticket scanning, entry validation                                                                 |
| Analytics Service      | Data aggregation, reporting, ML feature extraction                                                |
| Subscription Service   | User subscriptions, recurring payments, plan management                                           |
| Wallet Service         | User wallet, credits/debits, refunds, balance checks                                              |

### 2.2 Shared Libraries
- **Models**: Mongoose schemas for User, Event, Ticket, etc.
- **Interservice**: HTTP clients for inter-service communication.
- **Error Handler**: Centralized error formatting and logging.
- **JWT Middleware**: Auth token verification.

---

## 3. API Contracts

### 3.1 Example: Ticket Purchase Flow
- **POST /api/tickets/purchase**
  - Request: `{ userId, eventId, ticketType, quantity, paymentMethod }`
  - Response: `{ success, orderId, ticketDetails, price, message }`
  - Errors: `400 Bad Request`, `402 Payment Required`, `409 Conflict (oversell)`, `500 Internal Server Error`

### 3.2 Example: Dynamic Pricing
- **GET /api/events/:eventId/price**
  - Response: `{ eventId, recommendedPrice, basePrice, demandFactor, timestamp }`

### 3.3 Example: Error Logging
- **POST /api/logger/error**
  - Request: `{ service, endpoint, errorType, stack, userId, requestId, timestamp, context }`
  - Response: `{ success, logId }`

---

## 4. Data Models

### 4.1 User (MongoDB)
```js
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String (hashed),
  role: 'user' | 'admin' | 'organizer',
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 4.2 Event
```js
{
  _id: ObjectId,
  name: String,
  organizerId: ObjectId,
  basePrice: Number,
  dynamicRules: Object,
  ticketsAvailable: Number,
  startDate: Date,
  endDate: Date,
  status: 'active' | 'inactive',
  createdAt: Date,
  updatedAt: Date
}
```

### 4.3 Ticket
```js
{
  _id: ObjectId,
  eventId: ObjectId,
  userId: ObjectId,
  price: Number,
  status: 'purchased' | 'cancelled' | 'used',
  purchaseDate: Date,
  qrCode: String,
  ...
}
```

---

## 5. Error Handling & Logging
- All services use a shared error handler.
- Errors are logged locally and sent to a centralized logger-service via HTTP or message queue.
- Log schema includes: timestamp, service, endpoint, error type, stack trace, user/session, requestId, context.
- Alerts are triggered for critical errors or error clusters.

---

## 6. Security
- JWT for authentication, short-lived and refresh tokens.
- Passwords hashed with bcrypt (cost factor ≥ 10).
- CORS and Helmet for HTTP security.
- Rate limiting at API Gateway and Authentication Service.
- Sensitive data encrypted in transit (TLS) and at rest (MongoDB, backups).
- Role-based access control (RBAC) for admin/organizer endpoints.
- Input validation and sanitization on all APIs.

---

## 7. Deployment & Operations
- Each service is containerized (Docker), with health checks and resource limits.
- Orchestrated via Docker Compose (dev) or Kubernetes (prod).
- Environment variables for secrets/configuration (never hardcoded).
- Centralized logging (ELK/EFK stack or cloud logging).
- Monitoring with Prometheus/Grafana, alerting on error rates and latency.
- CI/CD pipeline for automated testing, linting, and deployment.

---

## 8. Observability
- Health endpoints (`/health`) in all services.
- Distributed tracing (e.g., OpenTelemetry) with correlation IDs.
- Real-time dashboards for errors, performance, and business metrics.

---

## 9. Extensibility & Maintainability
- New services can be added with minimal changes to API Gateway and shared libraries.
- ML model retraining and deployment is decoupled from main app.
- Code follows consistent style (ESLint, Prettier), with high test coverage.
- API documentation via Swagger/OpenAPI.

---

## 10. Diagrams
- See PlantUML/ for component, sequence, and state diagrams.
- Example diagrams: Service interaction, ticket purchase sequence, error propagation.

---

## 11. Open Items & Risks
- Finalize payment/email provider integration.
- Add logger-service for error graphing and analytics.
- Expand test coverage and documentation.
- Load testing and performance optimization.
- Data retention and archival policies.

---

*This LLD is a living document and should be updated as the system evolves.*
