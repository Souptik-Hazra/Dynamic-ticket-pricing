# Deployment Guide

## Prerequisites
- Node.js 16+
- Python 3.8+
- MongoDB, Redis, RabbitMQ (optional)

## Steps
1. Train ML model: `python train_model_enhanced.py` in `ml-model/`
2. Start ML API: `python app.py` in `ml-model/`
3. Start backend: `npm install && npm start` in `backend/`
4. Start frontend: `npm install && npm run dev` in `Dynamic-ticket-pricing/`

## Production Checklist
- Change secrets in `.env`
- Enable HTTPS
- Use managed database
- Set up Redis/RabbitMQ
- Monitor and backup
