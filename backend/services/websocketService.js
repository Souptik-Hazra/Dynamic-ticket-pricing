const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.clients = new Map(); // userId -> WebSocket
    this.eventSubscriptions = new Map(); // eventId -> Set of userIds
    
    this.init();
  }

  init() {
    this.wss.on('connection', (ws, req) => {
      console.log('🔌 New WebSocket connection');
      
      let userId = null;
      let isAuthenticated = false;

      ws.on('message', (message) => {
        console.log('WebSocket message received:', message);
        try {
          const data = JSON.parse(message);
          
          switch (data.type) {
            case 'auth':
              try {
                const decoded = jwt.verify(data.token, JWT_SECRET);
                userId = decoded.id;
                isAuthenticated = true;
                this.clients.set(userId, ws);
                ws.send(JSON.stringify({
                  type: 'auth_success',
                  message: 'Connected to real-time updates'
                }));
                console.log(`✅ User ${userId} authenticated via WebSocket`);
              } catch (err) {
                ws.send(JSON.stringify({
                  type: 'auth_error',
                  message: 'Invalid token'
                }));
              }
              break;

            case 'subscribe_event':
              if (!isAuthenticated) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Please authenticate first'
                }));
                return;
              }
              
              const eventId = data.eventId;
              if (!this.eventSubscriptions.has(eventId)) {
                this.eventSubscriptions.set(eventId, new Set());
              }
              this.eventSubscriptions.get(eventId).add(userId);
              ws.send(JSON.stringify({
                type: 'subscribed',
                eventId: eventId,
                message: `Subscribed to price updates for event ${eventId}`
              }));
              console.log(`User ${userId} subscribed to event ${eventId}`);
              break;

            case 'unsubscribe_event':
              if (this.eventSubscriptions.has(data.eventId)) {
                this.eventSubscriptions.get(data.eventId).delete(userId);
                console.log(`User ${userId} unsubscribed from event ${data.eventId}`);
              }
              break;

            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      });

      ws.on('close', () => {
        if (userId) {
          this.clients.delete(userId);
          this.eventSubscriptions.forEach((subscribers) => {
            subscribers.delete(userId);
          });
          console.log(`🔌 User ${userId} disconnected`);
        } else {
          console.log('WebSocket connection closed (unauthenticated user)');
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log('🔌 WebSocket server initialized');
  }

  // Broadcast price update to all subscribers of an event
  broadcastPriceUpdate(eventId, priceData) {
    const subscribers = this.eventSubscriptions.get(eventId);
    if (!subscribers) return;
    const message = JSON.stringify({
      type: 'price_update',
      eventId: eventId,
      data: priceData,
      timestamp: new Date().toISOString()
    });
    subscribers.forEach((userId) => {
      const client = this.clients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    console.log(`📊 Price update broadcasted to ${subscribers.size} subscribers for event ${eventId}`);
  }

  // Broadcast ticket sold notification
  broadcastTicketSold(eventId, ticketData) {
    const subscribers = this.eventSubscriptions.get(eventId);
    if (!subscribers) return;
    const message = JSON.stringify({
      type: 'ticket_sold',
      eventId: eventId,
      data: {
        remainingTickets: ticketData.remainingTickets,
        percentageSold: ticketData.percentageSold
      },
      timestamp: new Date().toISOString()
    });
    subscribers.forEach((userId) => {
      const client = this.clients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    console.log(`Ticket sold broadcasted to ${subscribers.size} subscribers for event ${eventId}`);
  }

  // Send notification to specific user
  sendToUser(userId, message) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      console.log(`Sent message to user ${userId}:`, message);
    }
  }

  // Broadcast to all connected users
  broadcast(message) {
    this.clients.forEach((client, userId) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        console.log(`Broadcasted message to user ${userId}:`, message);
      }
    });
  }

  // Get connection stats
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeSubscriptions: this.eventSubscriptions.size,
      totalSubscribers: Array.from(this.eventSubscriptions.values())
        .reduce((sum, set) => sum + set.size, 0)
    };
  }
}

module.exports = WebSocketService;
