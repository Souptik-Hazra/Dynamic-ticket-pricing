const amqp = require('amqplib');

let channel = null;
const QUEUE_NAME = 'ticket_purchases';

// Initialize RabbitMQ for async task processing
const initRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('✅ RabbitMQ connected');
  } catch (err) {
    console.warn('⚠️ RabbitMQ not available:', err.message);
  }
};

const messageQueueService = {
  // Send message to queue
  async sendMessage(message) {
    if (!channel) {
      console.log('Queue unavailable, processing synchronously');
      return false;
    }
    
    try {
      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
        persistent: true
      });
      return true;
    } catch (err) {
      console.error('Queue error:', err.message);
      return false;
    }
  },

  // Consume messages from queue
  async consumeMessages(callback) {
    if (!channel) return;
    
    try {
      await channel.consume(QUEUE_NAME, async (msg) => {
        if (msg) {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          channel.ack(msg);
        }
      });
    } catch (err) {
      console.error('Consume error:', err.message);
    }
  }
};

initRabbitMQ();
module.exports = messageQueueService;
