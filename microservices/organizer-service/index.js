import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import routes from './routes.js';
import cors from 'cors';
import jwtMiddleware from '../shared/jwtMiddleware.js';

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
app.use('/api', jwtMiddleware, routes);

const PORT = process.env.PORT || 4013;
app.listen(PORT, () => {
  console.log(`Organizer Service running on port ${PORT}`);
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'organizer-service', timestamp: new Date().toISOString() }));
