<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:1A2980,50:26D0CE,100:6DD5FA&height=260&section=header&text=Dynamic%20Ticket%20Pricing%20System&fontSize=42&fontColor=ffffff&fontAlignY=38&desc=AI-Powered%20Event%20Ticketing%20Platform&descAlignY=58&animation=fadeIn"/>

<br>

<p align="center">
<img src="https://readme-typing-svg.demolab.com?font=Poppins&weight=600&size=24&duration=3500&pause=1000&center=true&vCenter=true&width=900&lines=AI-Powered+Dynamic+Ticket+Pricing;MERN+Stack+%7C+Microservices+Architecture;XGBoost+Machine+Learning+Model;Docker+%7C+Redis+%7C+RabbitMQ+%7C+Electron" />
</p>

<br>

A production-ready **AI-powered Event Ticketing Platform** built using the **MERN Stack**, **Microservices**, **Machine Learning**, **Docker**, **Redis**, and **RabbitMQ** to intelligently optimize ticket prices in real time.

<p>

<a href="https://github.com/Souptik-Hazra/Dynamic-ticket-pricing">
<img src="https://img.shields.io/github/stars/Souptik-Hazra/Dynamic-ticket-pricing?style=for-the-badge&logo=github"/>
</a>

<a href="https://github.com/Souptik-Hazra/Dynamic-ticket-pricing/network/members">
<img src="https://img.shields.io/github/forks/Souptik-Hazra/Dynamic-ticket-pricing?style=for-the-badge"/>
</a>

<a href="https://github.com/Souptik-Hazra/Dynamic-ticket-pricing/issues">
<img src="https://img.shields.io/github/issues/Souptik-Hazra/Dynamic-ticket-pricing?style=for-the-badge"/>
</a>

<a href="LICENSE">
<img src="https://img.shields.io/github/license/Souptik-Hazra/Dynamic-ticket-pricing?style=for-the-badge"/>
</a>

</p>

---

# 📂 Project Structure

```text
Dynamic-ticket-pricing
│
├── microservices/
│   ├── api-gateway/
│   ├── authentication-service/
│   ├── user-service/
│   ├── organizer-service/
│   ├── analytics-service/
│   ├── payment-service/
│   ├── wallet-service/
│   ├── notification-service/
│   ├── websocket-service/
│   ├── qr-service/
│   ├── scanner-service/
│   └── shared/
│
├── ml-model/
├── src/
├── PlantUML/
├── postman/
├── production/
├── tests/
└── docker-compose.yml
```

---

# 🤖 Machine Learning

The pricing engine uses an **XGBoost Regression Model** to estimate optimal ticket prices using historical bookings, demand, venue capacity, and event-specific features.

### ML Service

- XGBoost Regression
- Flask REST API
- Gunicorn Production Server
- Joblib Model Serialization
- Dockerized Deployment

---

# 📡 Core Services

| Service | Responsibility |
|----------|----------------|
| API Gateway | Request routing |
| Authentication | JWT Authentication |
| User Service | User management |
| Organizer Service | Event management |
| Analytics Service | Reports & Insights |
| ML Service | Price Prediction |
| Redis | Distributed Cache |
| RabbitMQ | Asynchronous Messaging |
| MongoDB | Primary Database |

---

# 📸 Application Preview

> Replace these placeholders with the latest screenshots.

<p align="center">
<img src="assets/dashboard.png" width="90%">
</p>

<p align="center">
<img src="assets/home.png" width="48%">
<img src="assets/event-details.png" width="48%">
</p>

<p align="center">
<img src="assets/analytics.png" width="48%">
<img src="assets/booking.png" width="48%">
</p>

---

# 🚀 Quick Start

### Clone Repository

```bash
git clone https://github.com/Souptik-Hazra/Dynamic-ticket-pricing.git

cd Dynamic-ticket-pricing
```

### Run with Docker

```bash
docker compose build

docker compose up
```

Application

```text
Frontend      http://localhost:5173
API Gateway   http://localhost:3001
ML Service    http://localhost:5000
MongoDB       localhost:27017
Redis         localhost:6379
```

---

# 🧪 Testing

Run backend tests

```bash
npm test
```

Verify ML service

```bash
python test_api.py
```

Import the Postman collection from the **postman/** directory to test all APIs.

---

# 🗺️ Roadmap

- ✅ Microservice Architecture
- ✅ JWT Authentication
- ✅ Dynamic Ticket Pricing
- ✅ Analytics Dashboard
- ✅ Redis Integration
- ✅ RabbitMQ Integration
- ✅ Docker Deployment
- ✅ Electron Desktop
- ⏳ Payment Gateway
- ⏳ Email Notifications
- ⏳ Kubernetes Deployment
- ⏳ CI/CD Pipeline

---

# 🤝 Contributing

Contributions are welcome.

```bash
Fork → Create Branch → Commit → Push → Pull Request
```

Please follow the existing project structure and coding standards.

---

# 📄 License

Licensed under the **MIT License**.

See the **LICENSE** file for more information.

---

<div align="center">

## ⭐ Support the Project

If you found this project helpful, consider giving it a **⭐ Star** on GitHub.

<br>

<img src="https://skillicons.dev/icons?i=react,nodejs,express,mongodb,python,flask,docker,redis,rabbitmq,electron,git,github"/>

<br><br>

**Designed & Developed by Souptik Hazra**

*MCA @ VIT Vellore • AI • Machine Learning • Full Stack • Data Engineering*

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=0:1A2980,50:26D0CE,100:6DD5FA&height=120&section=footer"/>

</div>
<p>

<img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white"/>
<img src="https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/Express.js-Backend-000000?style=flat-square&logo=express"/>
<img src="https://img.shields.io/badge/MongoDB-Database-47A248?style=flat-square&logo=mongodb"/>
<img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python"/>
<img src="https://img.shields.io/badge/XGBoost-ML_Model-FFB000?style=flat-square"/>
<img src="https://img.shields.io/badge/Flask-ML_API-000000?style=flat-square&logo=flask"/>
<img src="https://img.shields.io/badge/Redis-Cache-DC382D?style=flat-square&logo=redis"/>
<img src="https://img.shields.io/badge/RabbitMQ-Message_Broker-FF6600?style=flat-square&logo=rabbitmq"/>
<img src="https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat-square&logo=docker"/>
<img src="https://img.shields.io/badge/Electron-Desktop_App-47848F?style=flat-square&logo=electron"/>

</p>

</div>

---

# 📖 Overview

The **Dynamic Ticket Pricing System** is a modern event management platform that combines **Artificial Intelligence**, **Machine Learning**, and a **Microservice-based Architecture** to automatically adjust ticket prices according to demand, venue capacity, booking trends, event popularity, and other real-time factors.

Unlike traditional ticket booking systems that rely on fixed pricing, this platform continuously predicts optimal ticket prices using a trained **XGBoost Machine Learning model**, helping organizers maximize revenue while offering fair pricing to customers.

The project is designed with scalability and production-readiness in mind, featuring Dockerized services, distributed caching, asynchronous messaging, REST APIs, centralized logging, and a dedicated ML prediction service.

---

# ✨ Key Features

## 🎟️ Event Management

- Event creation and management
- Organizer dashboard
- Multiple ticket categories
- Ticket inventory management
- Booking management
- QR-based ticket validation

---

## 🤖 AI Powered Dynamic Pricing

- XGBoost Regression Model
- Demand-based ticket pricing
- Historical sales analysis
- Capacity-aware pricing
- Event popularity prediction
- Real-time price recommendations

---

## 📊 Analytics

- Revenue analytics
- Sales dashboard
- Ticket insights
- Price history
- Booking statistics
- Organizer reports

---

## 🔐 Security

- JWT Authentication
- Role-based Authorization
- Password Hashing
- Protected REST APIs
- Rate Limiting
- Helmet Security Headers

---

## ⚡ Scalability

- API Gateway
- Microservice Architecture
- Redis Distributed Cache
- RabbitMQ Message Broker
- Docker Deployment
- Electron Desktop Support

---

# 🚀 Project Highlights

| Feature | Status |
|----------|--------|
| React + Vite Frontend | ✅ |
| Node.js Microservices | ✅ |
| API Gateway | ✅ |
| JWT Authentication | ✅ |
| Dynamic Ticket Pricing | ✅ |
| XGBoost ML Model | ✅ |
| Redis Caching | ✅ |
| RabbitMQ Messaging | ✅ |
| Docker Deployment | ✅ |
| Electron Desktop App | ✅ |
| Health Monitoring | ✅ |
| Production Logging | ✅ |

---

# 🏗️ High-Level Architecture

```mermaid
graph TD

User --> React

React --> API_Gateway

API_Gateway --> Authentication
API_Gateway --> User
API_Gateway --> Organizer
API_Gateway --> Analytics
API_Gateway --> Payment
API_Gateway --> Wallet
API_Gateway --> Notification
API_Gateway --> QR
API_Gateway --> Scanner

API_Gateway --> ML

Authentication --> MongoDB
User --> MongoDB
Organizer --> MongoDB
Analytics --> MongoDB
Wallet --> MongoDB

API_Gateway --> Redis
API_Gateway --> RabbitMQ

ML --> XGBoost

XGBoost --> ML
```

---

# 🔄 Application Workflow

```mermaid
flowchart LR

A[User Visits Website]

--> B[Browse Events]

--> C[Select Tickets]

--> D[Request Price Prediction]

--> E[ML Service Predicts Price]

--> F[Checkout]

--> G[Payment]

--> H[Booking Confirmed]

--> I[Analytics Updated]
```

---

# 🛠️ Technology Stack

| Category | Technologies |
|-----------|--------------|
| Frontend | React 19, Vite, Axios |
| Backend | Node.js, Express.js |
| API | REST APIs |
| Authentication | JWT |
| Database | MongoDB, Mongoose |
| Machine Learning | Python, Flask, XGBoost, Scikit-Learn |
| Caching | Redis |
| Messaging | RabbitMQ |
| Containerization | Docker |
| Desktop | Electron |
| Documentation | PlantUML, Postman |
| Version Control | Git & GitHub |