export default class WebSocketClient {
  constructor(token) {
    this.token = token;
    this.socket = null;
    this.listeners = {};
    this.shouldReconnect = true;
  }

  connect() {
    const wsUrl = (import.meta.env.VITE_WS_URL || `ws://localhost:3001/ws`);
    this.socket = new window.WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.send({ type: 'auth', token: this.token });
      console.log('WebSocket connected');
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      if (this.listeners[data.type]) {
        this.listeners[data.type].forEach(fn => fn(data));
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), 3000);
      }
    };
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.socket) {
      this.socket.close();
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(data));
    }
  }

  subscribeEvent(eventId) {
    this.send({ type: 'subscribe_event', eventId });
  }

  unsubscribeEvent(eventId) {
    this.send({ type: 'unsubscribe_event', eventId });
  }

  on(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }

  off(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(f => f !== fn);
    }
  }
}
