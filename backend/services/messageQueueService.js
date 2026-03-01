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
  },

  // Publish ticket purchase event to queue
  async publishTicketPurchase(data) {
    const message = {
      type: 'TICKET_PURCHASE',
      timestamp: new Date(),
      data: {
        ticketId: data.ticketId,
        eventId: data.eventId,
        userId: data.userId,
        quantity: data.quantity,
        totalAmount: data.totalAmount
      }
    };

    try {
      await this.sendMessage(message);
      console.log('Ticket purchase event queued:', data.ticketId);
      return true;
    } catch (err) {
      console.error('Failed to publish ticket purchase:', err.message);
      return false;
    }
  },

  // Publish analytics event to queue
  async publishAnalytics(data) {
    const message = {
      type: 'ANALYTICS_EVENT',
      timestamp: data.timestamp || new Date(),
      data: {
        eventType: data.type,
        eventId: data.eventId,
        quantity: data.quantity,
        revenue: data.revenue,
        timestamp: data.timestamp
      }
    };

    try {
      await this.sendMessage(message);
      console.log('Analytics event queued:', data.type);
      return true;
    } catch (err) {
      console.error('Failed to publish analytics:', err.message);
      return false;
    }
  },

  // Publish notification event to queue
  async publishNotification(data) {
    const message = {
      type: 'NOTIFICATION',
      timestamp: new Date(),
      data: {
        notificationType: data.type,
        userId: data.userId,
        ticketId: data.ticketId,
        orderId: data.orderId,
        message: data.message
      }
    };

    try {
      await this.sendMessage(message);
      console.log('Notification queued for user:', data.userId);
      return true;
    } catch (err) {
      console.error('Failed to publish notification:', err.message);
      return false;
    }
  }
};

initRabbitMQ();
module.exports = messageQueueService;
