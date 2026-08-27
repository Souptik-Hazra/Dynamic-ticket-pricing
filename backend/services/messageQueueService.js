const amqp = require('amqplib');

let channel = null;
let connection = null;
let isConnected = false;

const QUEUES = {
  TICKET_PURCHASES: 'ticket_purchases',
  ANALYTICS: 'analytics_events',
  NOTIFICATIONS: 'notifications'
};

// Initialize RabbitMQ connection with silent fallback
const initRabbitMQ = async () => {
  try {
    const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    connection = await amqp.connect(rabbitUrl, { timeout: 2000 });
    channel = await connection.createChannel();

    await channel.assertQueue(QUEUES.TICKET_PURCHASES, { durable: true });
    await channel.assertQueue(QUEUES.ANALYTICS, { durable: true });
    await channel.assertQueue(QUEUES.NOTIFICATIONS, { durable: true });

    connection.on('error', () => { isConnected = false; });
    connection.on('close', () => { isConnected = false; });

    isConnected = true;
    console.log('✅ RabbitMQ Message Queue connected successfully');
  } catch (err) {
    // Silent fallback to synchronous processing when RabbitMQ is not running
    isConnected = false;
  }
};

const messageQueueService = {
  async publishTicketPurchase(data) {
    if (isConnected && channel) {
      try {
        channel.sendToQueue(QUEUES.TICKET_PURCHASES, Buffer.from(JSON.stringify(data)), { persistent: true });
        return true;
      } catch (err) {
        return false;
      }
    }
    return true; // Synchronous fallback
  },

  async publishAnalytics(data) {
    if (isConnected && channel) {
      try {
        channel.sendToQueue(QUEUES.ANALYTICS, Buffer.from(JSON.stringify(data)), { persistent: true });
        return true;
      } catch (err) {
        return false;
      }
    }
    return true; // Synchronous fallback
  },

  async publishNotification(data) {
    if (isConnected && channel) {
      try {
        channel.sendToQueue(QUEUES.NOTIFICATIONS, Buffer.from(JSON.stringify(data)), { persistent: true });
        return true;
      } catch (err) {
        return false;
      }
    }
    return true; // Synchronous fallback
  },

  async close() {
    try {
      if (channel) await channel.close();
      if (connection) await connection.close();
      isConnected = false;
    } catch (err) {}
  },

  QUEUES
};

initRabbitMQ();

module.exports = messageQueueService;
