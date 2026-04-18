import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import routes from './routes.js';
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Use routes
app.use('/api/auth', routes);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'authentication-service', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Authentication Service running on port ${PORT}`);
});
