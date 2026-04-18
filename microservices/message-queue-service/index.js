import express from 'express';
import amqp from 'amqplib';
import dotenv from 'dotenv';
import cors from 'cors';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import { registerProcessHandlers } from '../shared/db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const RABBITMQ_URL  = process.env.RABBITMQ_URL || 'amqp://localhost';
const DEFAULT_QUEUE = 'tasks';

// ── RabbitMQ state ─────────────────────────────────────────────────────────
let channel         = null;
let connection      = null;
let reconnectTimer  = null;
let reconnectCount  = 0;
let mqReady         = false;

// ── Connect with exponential backoff ──────────────────────────────────────
async function connectRabbitMQ() {
  clearTimeout(reconnectTimer);
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    reconnectCount = 0;

    // Connection-level error/close → trigger reconnect
    connection.on('error', (err) => {
      console.error('[MQ] Connection error:', err.message);
      mqReady = false;
    });
    connection.on('close', () => {
      console.warn('[MQ] Connection closed — scheduling reconnect…');
      channel    = null;
      connection = null;
      mqReady    = false;
      scheduleReconnect();
    });

    // Create channel
    channel = await connection.createChannel();
    channel.on('error', (err) => {
      console.error('[MQ] Channel error:', err.message);
      channel = null;
      mqReady = false;
    });
    channel.on('close', () => {
      console.warn('[MQ] Channel closed');
      channel = null;
      mqReady = false;
    });

    // Declare queues (idempotent — safe to call on reconnect)
    await channel.assertQueue(DEFAULT_QUEUE, { durable: true });
    await channel.assertQueue('price_updates', { durable: true });
    await channel.assertQueue('ticket_purchases', { durable: true });
    await channel.assertQueue('email_notifications', { durable: true });

    // Per-consumer ack (ensures messages aren't lost if service crashes mid-process)
    channel.prefetch(1);

    mqReady = true;
    console.log('[MQ] RabbitMQ connected and queues asserted');
  } catch (err) {
    console.error('[MQ] Connection failed:', err.message);
    mqReady = false;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  reconnectCount++;
  // Exponential backoff: 1s, 2s, 4s … up to 30s max
  const delay = Math.min(1000 * Math.pow(2, reconnectCount - 1), 30000);
  console.log(`[MQ] Reconnecting in ${delay / 1000}s (attempt ${reconnectCount})`);
  reconnectTimer = setTimeout(connectRabbitMQ, delay);
}

// Initial connection attempt
connectRabbitMQ();

// ── Middleware: require RabbitMQ ───────────────────────────────────────────
const requireMQ = (_req, res, next) => {
  if (!mqReady || !channel) {
    return res.status(503).json({ error: 'Message queue unavailable (RabbitMQ offline)' });
  }
  next();
};

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({
    status:         'ok',
    service:        'message-queue-service',
    mqReady,
    reconnectCount,
    ts:             new Date().toISOString(),
  })
);

// ── POST /api/queue/publish — publish message to a queue ──────────────────
app.post('/api/queue/publish', requireMQ, async (req, res, next) => {
  try {
    const { message, queue = DEFAULT_QUEUE, persistent = true } = req.body;
    if (message === undefined || message === null)
      return res.status(400).json({ error: 'message is required' });

    const payload = typeof message === 'object'
      ? JSON.stringify(message)
      : String(message);

    // Ensure the target queue exists
    await channel.assertQueue(queue, { durable: true });

    const sent = channel.sendToQueue(
      queue,
      Buffer.from(payload),
      { persistent } // persistent:true → survives broker restart
    );

    if (!sent) return res.status(503).json({ error: 'Channel write buffer full, try again later' });

    res.json({ message: 'Published', queue, size: payload.length });
  } catch (err) { next(err); }
});

// ── GET /api/queue/consume — consume one message ──────────────────────────
app.get('/api/queue/consume', requireMQ, async (req, res, next) => {
  try {
    const queue = req.query.queue || DEFAULT_QUEUE;
    const msg   = await channel.get(queue, { noAck: false });

    if (!msg) return res.status(404).json({ error: 'No messages in queue', queue });

    const body = msg.content.toString();
    channel.ack(msg);

    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = body; }

    res.json({ message: parsed, queue, fields: msg.fields });
  } catch (err) { next(err); }
});

// ── GET /api/queue/status — queue depth info ──────────────────────────────
app.get('/api/queue/status', requireMQ, async (req, res, next) => {
  try {
    const queue = req.query.queue || DEFAULT_QUEUE;
    const info  = await channel.checkQueue(queue);
    res.json({ queue, messageCount: info.messageCount, consumerCount: info.consumerCount });
  } catch (err) { next(err); }
});

// ── 404 + Error handlers ──────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4008;
const server = app.listen(PORT, () => console.log(`Message Queue Service running on port ${PORT}`));
registerProcessHandlers(server, 'MessageQueueService');
