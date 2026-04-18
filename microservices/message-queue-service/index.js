const PORT = process.env.PORT || 4008;
app.listen(PORT, () => {
  console.log(`Message Queue Service running on port ${PORT}`);
});
// Message Queue Service Entry Point
import express from 'express';
import amqp from 'amqplib';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
let channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue('tasks', { durable: true });
}

connectRabbitMQ().then(() => {
  console.log('RabbitMQ connected');
}).catch(console.error);

// Publish message
app.post('/api/queue/publish', async (req, res) => {
  const { message } = req.body;
  try {
    channel.sendToQueue('tasks', Buffer.from(message));
    res.json({ message: 'Message published' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Consume message (for demonstration)
app.get('/api/queue/consume', async (req, res) => {
  try {
    channel.consume('tasks', (msg) => {
      if (msg) {
        res.json({ message: msg.content.toString() });
        channel.ack(msg);
      } else {
        res.status(404).json({ error: 'No messages' });
      }
    }, { noAck: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'message-queue-service', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
  console.log(`Message Queue Service running on port ${PORT}`);
});
