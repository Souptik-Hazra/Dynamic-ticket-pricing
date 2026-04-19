# Low Level Design: Dynamic Ticket Pricing System

## 1. Overview
This document describes the low-level design (LLD) for the Dynamic Ticket Pricing System, a distributed microservices-based platform for event ticketing with dynamic pricing, fraud detection, and real-time updates.

---

## 2. Service Architecture

### 2.1 Microservices
- **API Gateway**: Entry point, routing, rate limiting, CORS, authentication.
- **Admin Service**: Admin dashboard, event management, analytics, fraud detection.
- **Authentication Service**: User registration, login, JWT management.
- **User Service**: User profile, order history, user management.
- **Organizer Service**: Event creation, management, organizer dashboard.
- **Payment Service**: Payment processing, integration with third-party gateways.
- **Cache Service**: Redis-based caching, distributed locks, atomic inventory.
- **Email Service**: Notification emails (SMTP/third-party).
- **Notification Service**: In-app and push notifications.
- **WebSocket Service**: Real-time updates (ticket sold, price change).
- **QR Service**: QR code generation and validation.
- **Scanner Service**: Ticket scanning at entry points.
- **Analytics Service**: Data aggregation, reporting, ML feature extraction.
- **Subscription Service**: User subscriptions, recurring payments.
- **Wallet Service**: User wallet, credits/debits, refunds.

### 2.2 Shared Libraries
- **Models**: Mongoose schemas for User, Event, Ticket, etc.
- **Interservice**: HTTP clients for inter-service communication.
- **Error Handler**: Centralized error formatting and logging.
- **JWT Middleware**: Auth token verification.

---

## 3. Data Flow
- **Frontend (React)** communicates with API Gateway.
- **API Gateway** routes requests to appropriate microservices.
- **Microservices** interact with MongoDB, Redis, and external APIs (payment, email).
- **WebSocket Service** pushes real-time updates to clients.
- **ML Model (Python/Flask)** is called by backend for price prediction and fraud scoring.

---

## 4. Key Flows

### 4.1 Ticket Purchase
1. User selects event and ticket.
2. API Gateway routes to Payment Service.
3. Payment Service processes payment (Stripe/PayPal).
4. On success, Cache Service locks inventory, Ticket is allocated.
5. Email/Notification Service sends confirmation.
6. WebSocket Service broadcasts update.

### 4.2 Dynamic Pricing
1. Organizer sets base price and rules.
2. On ticket view/purchase, backend calls ML Model.
3. ML Model returns recommended price.
4. Price is updated in real-time and sent to frontend.

### 4.3 Fraud Detection
1. Admin Service aggregates user actions.
2. Analytics Service/ML Model scores for fraud.
3. High-risk actions are flagged and logged.

---

## 5. Database Design
- **MongoDB**: Users, Events, Tickets, Orders, Transactions, Logs.
- **Redis**: Inventory locks, session cache, rate limiting.

---

## 6. Error Handling & Logging
- All services use shared error handler.
- Errors are logged locally and (optionally) sent to a centralized logger-service.
- Logs include timestamp, service, endpoint, user/session, stack trace.

---

## 7. Security
- JWT for authentication, short-lived tokens, refresh tokens.
- Passwords hashed with bcrypt.
- CORS and Helmet for HTTP security.
- Rate limiting at API Gateway.
- Sensitive data encrypted in transit (TLS) and at rest.

---

## 8. Deployment
- Each service containerized (Docker).
- Orchestrated via Docker Compose or Kubernetes.
- Environment variables for secrets/config.

---

## 9. Monitoring & Observability
- Health endpoints in all services.
- Centralized logging and alerting (future: Prometheus/Grafana).
- Real-time error and performance dashboards.

---

## 10. Extensibility
- New services can be added with minimal changes to API Gateway and shared libraries.
- ML model retraining and deployment is decoupled from main app.

---

## 11. Diagrams
- See PlantUML/ for component, sequence, and state diagrams.

---

## 12. Open Items
- Finalize payment/email provider integration.
- Add logger-service for error graphing.
- Expand test coverage and documentation.

---

*This LLD should be updated as the system evolves.*
