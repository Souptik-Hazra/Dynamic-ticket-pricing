/**
 * useWebSocket — connects to websocket-service (:4010), authenticates with JWT,
 * and exposes real-time events to React components.
 *
 * Usage:
 *   const { connected, lastEvent } = useWebSocket();
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { getWsUrl } from '../config/api';

const WS_URL = getWsUrl();
const RECONNECT_DELAY_MS  = 3000;
const MAX_RECONNECT_TRIES = 10;

export function useWebSocket() {
  const wsRef        = useRef(null);
  const retriesRef   = useRef(0);
  const timerRef     = useRef(null);
  const mountedRef   = useRef(true);

  const [connected,  setConnected]  = useState(false);
  const [lastEvent,  setLastEvent]  = useState(null); // { type, ...payload }

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || !mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      // Send auth frame immediately on connect
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'auth_success') {
          if (mountedRef.current) setConnected(true);
          return;
        }
        if (msg.type === 'pong') return; // ignore keepalive
        if (mountedRef.current) setLastEvent(msg);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      wsRef.current = null;
      if (retriesRef.current < MAX_RECONNECT_TRIES) {
        retriesRef.current += 1;
        timerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => ws.close(); // trigger onclose → reconnect
  }, []);

  // Keepalive ping every 30 s
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setConnected(false);
      return;
    }

    const pingTimer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearInterval(pingTimer);
      clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect loop on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, localStorage.getItem('token')]); // Re-run if token changes (logout/login)

  return { connected, lastEvent };
}

export default useWebSocket;
