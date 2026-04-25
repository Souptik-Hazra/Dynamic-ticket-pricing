import { useEffect, useRef, useState, useCallback } from 'react';
import { getWsUrl } from '../config/api';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const MAX_RECONNECT_TRIES = 10;

/**
 * useWebSocket — connects to websocket-service (:4010), authenticates with JWT,
 * and exposes real-time events to React components.
 */
export function useWebSocket() {
  const wsRef = useRef(null);
  const retriesRef = useRef(0);
  const timerRef = useRef(null);
  const mountedRef = useRef(false);
  const lastFetchTokenRef = useRef(null);
  const connectRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [throttle, setThrottle] = useState(0);
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // Keep token state in sync with other tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'token') setToken(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const connect = useCallback(() => {
    const WS_URL = getWsUrl();
    if (!token || !mountedRef.current) return;
    if (wsRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        if (mountedRef.current && token) {
          try { ws.send(JSON.stringify({ type: 'auth', token })); } catch { /* ignore */ }
          setConnected(true);
        }
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'auth_success') {
            if (mountedRef.current) {
              setConnected(true);
              setThrottle(msg.throttle || 0);
            }
            return;
          }
          if (msg.type === 'pong') return;
          if (mountedRef.current) setLastEvent(msg);
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        if (retriesRef.current < MAX_RECONNECT_TRIES) {
          const attempt = retriesRef.current + 1;
          retriesRef.current = attempt;
          const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt - 1), RECONNECT_MAX_MS);
          timerRef.current = setTimeout(() => {
            if (mountedRef.current) connectRef.current?.();
          }, delay);
        }
      };

      ws.onerror = (err) => {
        try { ws.close(); } catch { /* ignore */ }
        console.debug('WebSocket error', err);
      };
    } catch (err) {
      console.debug('Failed to construct WebSocket', err);
    }
  }, [token]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    lastFetchTokenRef.current = token;
    if (!token) {
      const disconnectTimer = setTimeout(() => setConnected(false), 0);
      return () => {
        clearTimeout(disconnectTimer);
        mountedRef.current = false;
      };
    }

    connect();

    const pingTimer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
      }
    }, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(pingTimer);
      clearTimeout(timerRef.current);
      if (wsRef.current) {
        try { wsRef.current.onclose = null; wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [connect, token]);

  return { connected, lastEvent, throttle };
}

export default useWebSocket;