# Environment Configuration

## Backend `.env` Example
```
MONGODB_URI=mongodb://localhost:27017/dynamic-ticket-pricing
PORT=3001
ML_API_URL=http://localhost:5000
JWT_SECRET=your-256-bit-secret-key
JWT_EXPIRE=7d
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost
```

## ML Model
- Model file: `model.pkl`
- Scaler file: `scaler.pkl`
