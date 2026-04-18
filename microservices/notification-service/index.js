// Notification Service Entry Point
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// In-memory notification store (for demo)
const notifications = [];

// Send notification
app.post('/api/notifications', (req, res) => {
  const { to, type, message } = req.body;
  const notification = { to, type, message, timestamp: new Date() };
  notifications.push(notification);
  res.json({ message: 'Notification sent', notification });
});

// Get all notifications
app.get('/api/notifications', (req, res) => {
  res.json(notifications);
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4009;
app.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
});
