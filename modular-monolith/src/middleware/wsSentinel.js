import jwt from 'jsonwebtoken';
import User from '../modules/users/model/user.model.js';
import { logSecurity } from '../shared/utils/logger.js';

const connectionCounts = new Map();
const MAX_CONNECTIONS_PER_IP = 5;

/**
 * wsSentinel
 * 
 * Optimized WebSocket Guard with Persistent Logging.
 */
export const wsSentinel = async (ws, req) => {
  const ip = req.socket.remoteAddress;
  
  // 1. IP Rate Limiting
  const currentCount = connectionCounts.get(ip) || 0;
  if (currentCount >= MAX_CONNECTIONS_PER_IP) {
    await logSecurity('wsSentinel', `IP ${ip} exceeded WS connection limit`, { currentCount });
    ws.send(JSON.stringify({ type: 'error', code: 'CONNECTION_LIMIT_EXCEEDED' }));
    ws.terminate();
    return;
  }
  
  connectionCounts.set(ip, currentCount + 1);
  ws.on('close', () => {
    const count = connectionCounts.get(ip) || 1;
    connectionCounts.set(ip, Math.max(0, count - 1));
  });

  // 2. Mandatory Auth Handshake
  ws.authTimeout = setTimeout(async () => {
    if (!ws.userId) {
      await logSecurity('wsSentinel', `Terminating unauthenticated socket from ${ip}`);
      ws.send(JSON.stringify({ type: 'error', code: 'AUTH_TIMEOUT' }));
      ws.terminate();
    }
  }, 10000);
};

export const verifyWsToken = async (ws, token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('botScore role');
    
    if (!user) return false;

    ws.userId = String(user._id);
    ws.role = user.role;
    ws.botScore = user.botScore || 0;
    
    // Calculate Throttle Window
    ws.throttleDelay = Math.min(2000, ws.botScore * 200);

    clearTimeout(ws.authTimeout);
    return true;
  } catch (err) {
    return false;
  }
};
