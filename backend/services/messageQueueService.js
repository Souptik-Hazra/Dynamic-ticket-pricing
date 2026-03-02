const amqp = require('amqplib');

let channel = null;
let connection = null;
let isConnected = false;

// Queue names
const QUEUES = {
  TICKET_PURCHASES: 'ticket_purchases',
  ANALYTICS: 'analytics_events',
  NOTIFICATIONS: 'notifications'
};

// Initialize RabbitMQ connection
const initRabbitMQ = async () => {
  try {
    const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    connection = await amqp.connect(rabbitUrl);
    channel = await connection.createChannel();
    
    // Assert all queues
    await channel.assertQueue(QUEUES.TICKET_PURCHASES, { durable: true });
    await channel.assertQueue(QUEUES.ANALYTICS, { durable: true });
    await channel.assertQueue(QUEUES.NOTIFICATIONS, { durable: true });
    
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
  // Generic send message
  async sendMessage(queueName, message) {
    if (!isConnected || !channel) {
      console.log('Message queue not available, processing synchronously');
      return false;
    }
    
    try {
      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true
      });
      return true;
    } catch (err) {
      console.error('Error sending message to queue:', err);
      return false;
    }
  },

  // Publish ticket purchase event
  async publishTicketPurchase(data) {
    if (!isConnected) {
      console.log('📧 [Sync] Processing ticket purchase:', data.ticketId);
      // Process synchronously - e.g., send confirmation email directly
      return this.processTicketPurchaseSync(data);
    }
    return this.sendMessage(QUEUES.TICKET_PURCHASES, {
      type: 'TICKET_PURCHASE',
      data,
      timestamp: new Date()
    });
  },

  // Publish analytics event
  async publishAnalytics(data) {
    if (!isConnected) {
      console.log('📊 [Sync] Logging analytics:', data.type);
      // Analytics can be logged directly to console/DB if queue unavailable
      return true;
    }
    return this.sendMessage(QUEUES.ANALYTICS, {
      type: 'ANALYTICS',
      data,
      timestamp: new Date()
    });
  },

  // Publish notification
  async publishNotification(data) {
    if (!isConnected) {
      console.log('🔔 [Sync] Processing notification:', data.type);
      // Process notification synchronously
      return this.processNotificationSync(data);
    }
    return this.sendMessage(QUEUES.NOTIFICATIONS, {
      type: 'NOTIFICATION',
      data,
      timestamp: new Date()
    });
  },

  // Synchronous fallback handlers
  processTicketPurchaseSync(data) {
    // Could send email directly here if email service is configured
    console.log(`✅ Ticket ${data.ticketId} confirmed for user ${data.userId}`);
    return true;
  },

  processNotificationSync(data) {
    console.log(`🔔 Notification: ${data.type} - ${data.message || 'No message'}`);
    return true;
  },

  // Consume messages from a queue
  async consumeMessages(queueName, callback) {
    if (!isConnected || !channel) {
      console.log('Message queue not available');
      return;
    }
    
    try {
      channel.consume(queueName, async (msg) => {
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

  // Start consuming all queues (call this from server.js if needed)
  async startConsumers() {
    if (!isConnected) return;

    // Ticket purchase consumer
    await this.consumeMessages(QUEUES.TICKET_PURCHASES, async (msg) => {
      console.log('📧 Processing ticket purchase from queue:', msg.data.ticketId);
      // Add email sending logic here
    });

    // Analytics consumer
    await this.consumeMessages(QUEUES.ANALYTICS, async (msg) => {
      console.log('📊 Processing analytics event:', msg.data.type);
      // Add analytics processing logic here
    });

    // Notifications consumer
    await this.consumeMessages(QUEUES.NOTIFICATIONS, async (msg) => {
      console.log('🔔 Processing notification:', msg.data.type);
      // Add notification sending logic here
    });

    console.log('✅ Message queue consumers started');
  },

  async close() {
    try {
      if (channel) await channel.close();
      if (connection) await connection.close();
      isConnected = false;
    } catch (err) {
      console.error('Error closing message queue connection:', err);
    }
  },

  // Expose queue names
  QUEUES
};

// Initialize on module load
initRabbitMQ().catch(err => {
  console.warn('⚠️  Message queue service initialization failed, running without queue');
});

module.exports = messageQueueService;
