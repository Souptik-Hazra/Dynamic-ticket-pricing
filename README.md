# 🎫 FanFever: Dynamic Ticket Pricing System

A high-performance, **Microservices-based** event ticketing platform with intelligent dynamic pricing powered by **Machine Learning (XGBoost)**. Built for the Indian market with ₹ (Rupee) currency support.

---

## 🏗️ Architecture: Distributed Microservices

Unlike monolithic systems, FanFever is built as a distributed network of **17 independent services** orchestrated through a central **API Gateway**.

### Core Infrastructure
- **API Gateway (Port 3001)**: The single entry point. Provides routing, rate limiting, and unified CORS.
- **Shared Library**: Centralized database models and inter-service HTTP clients (fire-and-forget).
- **Redis Cache (Port 4005)**: Handles distributed locking and high-frequency data caching.
- **WebSocket Service (Port 4010)**: Real-time "Ticket Sold" and "Price Change" broadcasts.

### Business Services
- **Auth (4001)** / **User (4002)**: Secure JWT-based identity management.
- **Admin (4003)**: Total platform management and statistic aggregation.
- **Organizer (4013)**: Event creation, price management, and ticket logic.
- **Payment (4004)** / **Wallet (4016)**: Secure transaction handling and internal credit balancing.
- **Subscription (4012)**: Tiered membership management (Weekly, Monthly, Annual).
- **Analytics (4011)** / **Notification (4009)** / **Scanner (4015)**: Ancillary support services.

---

## 🧠 ML-Powered Dynamic Pricing

The system features a custom-trained **XGBoost** model that adjusts ticket prices in real-time based on high-fidelity database signals.

### **The 15-Field Predictor**
The model strictly relies on raw database fields, eliminating brittle heuristics:
1.  `capacity`: Venue size.
2.  `tickets_sold`: Real-time occupancy.
3.  `base_price`: Starting price point.
4.  `days_until_event`: Time pressure.
5.  `event_duration`: Duration in days.
6.  `event_popularity`: (0.0 to 1.0).
7.  `venue_tier`: (1 to 5).
8.  `artist_tier`: (1 to 5).
9.  `is_holiday`: Boolean flag.
10-15. `category`: One-hot encoded (Concert, Sports, Theater, etc.).

---

## 📁 Project Structure

```bash
Dynamic-ticket-pricing/
├── microservices/             # Node.js distributed services
│   ├── api-gateway/          # Central Proxy (Port 3001)
│   ├── shared/                # Shared Mongoose models & API clients
│   ├── authentication-service # Port 4001
│   ├── organizer-service      # Port 4013 (Events & Prices)
│   └── ... (14 other services)
│
├── ml-model/                  # Python/Flask Analytics Service
│   ├── app.py                # Prediction API (Port 5000)
│   ├── model.pkl             # Trained XGBoost artifact
│   └── scaler.pkl            # Feature normalization
│
├── src/                       # React Frontend (Vite)
│   ├── components/            # Modularized, CSS-scoped components
│   ├── context/               # Global Auth & State
│   └── config/api.js          # Centralized route registry
└── restart-all.bat            # One-click system orchestrator
```

---

## 🚀 Quick Start

### 1. Unified Startup
Ensure **MongoDB** and **Redis** are running, then execute the orchestrator:
```bash
./restart-all.bat
```
This will launch the Gateway (3001), the Python ML API (5000), and all supporting microservices in individual windows.

### 2. Frontend Launch
In a separate terminal:
```bash
npm run dev
```

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Context API, Vanilla CSS (Modular).
- **Backend**: Node.js, Express, MongoDB/Mongoose.
- **Machine Learning**: Python 3.13, Flask, XGBoost, Scikit-learn.
- **Performance**: Redis (Distributed Caching & Locking).
- **Communication**: Inter-service Axios (Internal) & API Gateway Proxy (External).

---

## 👨‍💻 Key Design Principles

1.  **Modular CSS**: Styles are scoped to components (e.g., `Navigation.css`) to prevent global leakage.
2.  **Graceful Degradation**: Core booking logic operates even if ancillary services (like Analytics) are temporarily down.
3.  **Atomic Inventory**: Distributed locks on Redis prevent overselling seats during high-demand bursts.
4.  **Dynamic Pricing Source of Truth**: Pricing is dynamically calculated on the backend; the frontend merely renders the real-time adjustments.

---
**FanFeverTickets** — *The Future of Intelligent Event Ticketing in India.* 🇮🇳
