// WebSocket Service Entry Point
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());

wss.on('connection', ws => {
  ws.send('WebSocket Service Connected');
  ws.on('message', message => {
    // Echo message for demo
    ws.send(`Echo: ${message}`);
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'websocket-service', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4010;
server.listen(PORT, () => {
  console.log(`WebSocket Service running on port ${PORT}`);
});
