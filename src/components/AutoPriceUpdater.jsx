import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import './AutoPriceUpdater.css';

function AutoPriceUpdater({ eventId, onPriceUpdate, compact = false }) {
  const [priceInfo, setPriceInfo] = useState(null);

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

  const hypeIndex = priceInfo?.factors?.bertHypeIndex;
  const isColdStart = priceInfo?.factors?.isColdStart;

  return (
    <div className={`auto-price-updater ${compact ? 'compact' : ''} bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}>
      <div className="updater-header">
        <span className="updater-icon">🤖</span>
        <span className="updater-title">XGBoost Dynamic Pricing</span>
        {hypeIndex !== undefined && (
          <span className="hype-badge" title="BERT Hype Sentiment Index">
            🔥 Hype {Math.round(hypeIndex * 100)}%
          </span>
        )}
        {isColdStart && (
          <span className="coldstart-badge" title="BERT Demand Signal Active for Cold-Start">
            ❄️ Cold-Start
          </span>
        )}
      </div>

      {priceInfo?.prices && (
        <div className="prices-row">
          {Object.entries(priceInfo.prices).map(([category, price]) => (
            <span key={category} className="price-tag">
              {category.toUpperCase()}: ₹{price}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default AutoPriceUpdater;
