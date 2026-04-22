import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

function AutoPriceUpdater({ eventId, onPriceUpdate, compact = false }) {
  const [priceInfo, setPriceInfo] = useState(null);

  const fetchDynamicPrice = useCallback(async () => {
    if (!eventId) return;
    
    try {
      const response = await api.get(`/events/${eventId}/dynamic-prices`);
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

  return (
    <div className={`cyber-card ${compact ? 'compact' : ''}`} style={{ padding: compact ? '0.5rem 1rem' : '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dim)' }}>
      <div className="flex-between" style={{ marginBottom: '0.8rem' }}>
        <div className="flex-center" style={{ gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🤖</span>
          <span className="cyber-label" style={{ fontSize: '0.75rem' }}>Dynamic Pricing Engine</span>
        </div>
        <div className="cyber-pulse" style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }}></div>
      </div>

      {priceInfo?.prices && (
        <div className="flex-center" style={{ flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'flex-start' }}>
          {Object.entries(priceInfo.prices).map(([category, price]) => (
            <span key={category} className="cyber-badge badge-info" style={{ fontSize: '0.65rem', padding: '0.2rem 0.6rem' }}>
              {category}: ₹{price.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default AutoPriceUpdater;
