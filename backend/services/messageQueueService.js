const amqp = require('amqplib');

let channel = null;
let connection = null;
let isConnected = false;

const QUEUE_NAME = 'ticket_purchases';

// Initialize RabbitMQ connection
const initRabbitMQ = async () => {
  try {
    const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    connection = await amqp.connect(rabbitUrl);
    channel = await connection.createChannel();
    
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    
    connection.on('error', (err) => {
      console.error('RabbitMQ connection error:', err);
      isConnected = false;
    });
    
    connection.on('close', () => {
      console.log('RabbitMQ connection closed');
      isConnected = false;
    });
    
    isConnected = true;
    console.log('✅ RabbitMQ connected');
  } catch (err) {
    console.warn('⚠️  RabbitMQ not available, message queue disabled:', err.message);
    isConnected = false;
  }
};

const messageQueueService = {
  async sendMessage(message) {
    if (!isConnected || !channel) {
      console.log('Message queue not available, processing synchronously');
      return false;
    }
    
    try {
      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
        persistent: true
      });
      return true;
    } catch (err) {
      console.error('Error sending message to queue:', err);
      return false;
    }
  },

  async consumeMessages(callback) {
    if (!isConnected || !channel) {
      console.log('Message queue not available');
      return;
    }
    
    try {
      channel.consume(QUEUE_NAME, async (msg) => {
        if (msg !== null) {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          channel.ack(msg);
        }
      });
    } catch (err) {
      console.error('Error consuming messages:', err);
    }
  },

  async close() {
    try {
      if (channel) await channel.close();
      if (connection) await connection.close();
      isConnected = false;
    } catch (err) {
      console.error('Error closing message queue connection:', err);
    }
  }
};

// Initialize on module load
initRabbitMQ().catch(err => {
  console.warn('⚠️  Message queue service initialization failed, running without queue');
});

module.exports = messageQueueService;
