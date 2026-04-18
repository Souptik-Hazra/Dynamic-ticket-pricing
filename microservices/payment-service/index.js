import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import routes from './routes.js';
import cors from 'cors';
import jwtMiddleware from '../shared/jwtMiddleware.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'payment-service', timestamp: new Date().toISOString() }));

app.use('/api/payments', jwtMiddleware, routes);

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});
