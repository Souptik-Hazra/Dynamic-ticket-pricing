# Dynamic Ticket Pricing Deployment Guide

This project consists of three distinct components that need to be deployed separately likely on a platform like Render, Heroku, or Railway.

## 1. Backend (Node.js/Express)
- **Directory:** `backend/`
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Environment Variables:**
  - `PORT`: (Provided by host, e.g., 10000)
  - `MONGODB_URI`: Your production MongoDB connection string (e.g., MongoDB Atlas).
  - `ALLOWED_ORIGINS`: Comma-separated list of frontend URLs (e.g., `https://your-frontend.onrender.com`).
  - `JWT_SECRET`: A strong random string.
  - `ML_API_URL`: URL of your deployed ML Model service.

## 2. ML Model (Python/Flask)
- **Directory:** `ml-model/`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn app:app` (Recommended for production) or `python app.py`
- **Environment Variables:**
  - `PORT`: (Provided by host)
  - `ML_PORT`: (Optional, can match PORT)
  - `FLASK_DEBUG`: `0`

## 3. Frontend (React/Vite)
- **Directory:** Root (`/`)
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Environment Variables (Set at Build Time):**
  - `VITE_API_URL`: URL of your deployed Backend service (e.g., `https://your-backend.onrender.com/api`).
  - `VITE_ML_API_URL`: URL of your deployed ML Model service.

## General Notes
- **Monorepo:** Since all code is in one repository, you will likely need to configure the "Root Directory" setting in your cloud provider for each service to point to `backend/` or `ml-model/` respectively.
- **Database:** Ensure your MongoDB instance allows connections from your deployment IP addresses (or allow access from anywhere `0.0.0.0/0` if using a free tier cluster with proper authentication).
