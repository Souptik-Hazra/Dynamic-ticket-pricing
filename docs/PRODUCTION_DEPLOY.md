# 🚀 Production Deployment Guide: FanFever Modular Monolith

This guide outlines the steps to deploy the FanFever platform using the new **Modular Monolith** architecture. This structure simplifies deployment from 17 containers to a single unified core and a frontend layer.

---

## 🏗️ Recommended Infrastructure

- **vCPU**: 4+ Cores (Required for Python-based Neural Pricing Inference).
- **RAM**: 8GB+ (Shared between Node.js event loop and TensorFlow/Keras sidecar).
- **Storage**: SSD-backed for MongoDB and Neo4j log persistence.

---

## 🐳 Option 1: Docker Compose (Recommended)

The easiest way to deploy the entire stack is using the optimized `docker-compose.yml`.

1.  **Configure Environment**:
    - Copy `.env.production.example` to `.env`.
    - Fill in your production credentials (MongoDB URI, Stripe Keys, JWT Secret).

2.  **Launch the Stack**:
    ```bash
    docker-compose up -d --build
    ```
    *This will automatically build the Polyglot Monolith (Node + Python) and the multi-stage Frontend image.*

3.  **Verify Services**:
    - **Frontend**: Port 80 (or as configured)
    - **Monolith API**: Port 4000 (Internal)
    - **ML Sidecar**: Port 5000 (Internal)

---

## 🛠️ Option 2: Manual Deployment (PM2 + Nginx)

For high-performance Linux environments without Docker.

### 1. Backend Setup (Monolith)
```bash
cd modular-monolith
npm install --production
pip3 install -r ml-model/requirements.txt
```

### 2. Sidecar Management
Use PM2 to manage both the Node.js server and the Python model:
```bash
# Start Monolith (handles Python internally)
pm2 start server.js --name fanfever-monolith
```

### 3. Frontend Build
```bash
npm install
npm run build
# Serve 'dist' folder via Nginx or 'serve'
```

---

## 🛡️ Post-Deployment Checklist

1.  **SSL/TLS**: Mandatory for Federated Learning. Secure contexts are required for the browser-side `crypto.subtle` API used in the Edge-AI Sentinel.
2.  **ML Warmup**: Trigger a few test price predictions to ensure the Python bridge and Keras models are loaded into RAM.
3.  **Database Indexing**: Ensure the `SystemLog` and `Ticket` collections have the correct indexes (created automatically on first run, but verify via MongoDB Compass/Shell).
4.  **BotShield Tuning**: Review the `botShield.js` middleware logs in production to calibrate the rate-limiting thresholds for your specific traffic patterns.

---

## 📊 Monitoring & Maintenance

- **Health Checks**: Monitor `https://api.your-domain.com/health` for overall system heartbeat.
- **AI Analytics**: Access the **🛡️ Market Security** tab in the Admin Dashboard to monitor real-time "Cognitive Confidence" scores and bot rejection rates.
- **Log Rotation**: Ensure PM2 or Docker logs are rotated to prevent disk exhaustion from high-frequency telemetry.

---

## ⚖️ License
Proprietary implementation of the DECPG Framework. All rights reserved.
