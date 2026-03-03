import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import WebSocketClient from '../utils/websocketClient';
import './AutoPriceUpdater.css';

function AutoPriceUpdater({ eventId, onPriceUpdate, compact = false }) {
  const [priceInfo, setPriceInfo] = useState(null);
  const [wsClient, setWsClient] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !wsClient) {
      const client = new WebSocketClient(token);
      client.connect();
      setWsClient(client);
    }
    return () => {
      if (wsClient) wsClient.disconnect();
    };
  }, []);

  const fetchDynamicPrice = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await axios.get(`${API_URL}/events/${eventId}/dynamic-prices`);
      if (response.data) {
        setPriceInfo(response.data);
        if (onPriceUpdate) {
          onPriceUpdate(response.data);
        }
      }
    } catch (error) {
      console.error('Error fetching dynamic price:', error);
    }
  }, [eventId, onPriceUpdate]);

  useEffect(() => {
    fetchDynamicPrice();
    const interval = setInterval(fetchDynamicPrice, 30000);
    return () => clearInterval(interval);
  }, [fetchDynamicPrice]);

  useEffect(() => {
    if (!eventId || !wsClient) return;
    wsClient.on('auth_success', () => {
      wsClient.subscribeEvent(eventId);
    });
    wsClient.on('price_update', (data) => {
      if (data.eventId === eventId && data.data) {
        setPriceInfo(data.data);
        if (onPriceUpdate) onPriceUpdate(data.data);
      }
    });
    return () => {
      wsClient.off('auth_success');
      wsClient.off('price_update');
    };
  }, [eventId, wsClient, onPriceUpdate]);

  return (
    <div className={`auto-price-updater ${compact ? 'compact' : ''} bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}>
      <div className="updater-header">
        <span className="updater-icon">🤖</span>
        <span className="updater-title">Dynamic Pricing</span>
      </div>

      {priceInfo?.prices && (
        <div className="prices-row">
          {Object.entries(priceInfo.prices).map(([category, price]) => (
            <span key={category} className="price-tag">
              {category}: ₹{price}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default AutoPriceUpdater;
