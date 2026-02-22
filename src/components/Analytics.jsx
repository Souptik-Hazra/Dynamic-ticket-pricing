
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, ML_API_URL } from '../config/api';
import './Analytics.css';

function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    fetchPeakHours();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/analytics`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeakHours = async () => {
    try {
      const response = await axios.get(`${ML_API_URL}/peak-hours/predict`);
      if (response.data.success) {
        setPeakHours(response.data.peak_hours);
      }
    } catch (error) {
      console.error('Error fetching peak hours:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="error">Failed to load analytics</div>;
  }

  return (
    <div className="analytics-container bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <h2>System Analytics</h2>

      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="card-icon">🎭</div>
          <div className="card-content">
            <h3>Total Events</h3>
            <p className="stat-value">{analytics.totalEvents}</p>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-icon">🎟️</div>
          <div className="card-content">
            <h3>Tickets Sold</h3>
            <p className="stat-value">{analytics.totalTicketsSold}</p>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <h3>Total Revenue</h3>
            <p className="stat-value">₹{analytics.totalRevenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-icon">📅</div>
          <div className="card-content">
            <h3>Upcoming Events</h3>
            <p className="stat-value">{analytics.upcomingEvents}</p>
          </div>
        </div>
      </div>

      {peakHours && (
        <div className="peak-hours-section">
          <h2>⏰ Peak Hours & Demand Patterns</h2>
          
          {/* Peak Hours Summary */}
          <div className="peak-summary-grid">
            <div className="peak-card">
              <div className="card-icon">🔴</div>
              <div className="card-content">
                <h4>Peak Hours</h4>
                <p className="peak-value">{peakHours.peak_hours?.join(', ')}</p>
                <small>Max demand times</small>
              </div>
            </div>

            <div className="peak-card">
              <div className="card-icon">🟢</div>
              <div className="card-content">
                <h4>Off-Peak Hours</h4>
                <p className="peak-value">{peakHours.off_peak_hours?.slice(0, 5).join(', ')}...</p>
                <small>Cheapest time to buy</small>
              </div>
            </div>

            <div className="peak-card">
              <div className="card-icon">⭐</div>
              <div className="card-content">
                <h4>Best Hours</h4>
                <p className="peak-value">{peakHours.best_hours?.join(', ')}</p>
                <small>Highest demand</small>
              </div>
            </div>

            <div className="peak-card">
              <div className="card-icon">💰</div>
              <div className="card-content">
                <h4>Worst Hours</h4>
                <p className="peak-value">{peakHours.worst_hours?.join(', ')}</p>
                <small>Lowest demand</small>
              </div>
            </div>
          </div>

          {/* 24-Hour Demand Chart */}
          {peakHours.hourly_demand && (
            <div className="hourly-chart-container">
              <h3>24-Hour Demand Distribution</h3>
              <div className="hourly-demand-chart">
                {Object.entries(peakHours.hourly_demand).map(([hour, multiplier]) => (
                  <div key={hour} className="hour-bar-wrapper">
                    <div 
                      className={`hour-bar ${multiplier > 1.3 ? 'peak' : multiplier < 0.3 ? 'off-peak' : 'normal'}`}
                      style={{height: `${multiplier * 40}px`}}
                      title={`${hour}:00 - ${(multiplier).toFixed(2)}x demand`}
                    >
                      {multiplier > 1.3 && <span className="peak-indicator">📈</span>}
                    </div>
                    <span className="hour-label">{hour}</span>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <div><span className="legend-dot peak"></span> Peak (&gt;1.3x)</div>
                <div><span className="legend-dot normal"></span> Normal (0.3-1.3x)</div>
                <div><span className="legend-dot off-peak"></span> Off-Peak (&lt;0.3x)</div>
              </div>
            </div>
          )}

          {/* Weekly Pattern Info */}
          <div className="weekly-pattern">
            <h3>Weekly Demand Pattern</h3>
            <div className="weekly-info">
              <p><strong>📅 Monday:</strong> Slight dip (0.9x)</p>
              <p><strong>📅 Tuesday-Thursday:</strong> Normal to rising (1.0-1.2x)</p>
              <p><strong>🎉 Friday-Saturday:</strong> Peak demand (1.2-1.3x) - Higher prices</p>
              <p><strong>📅 Sunday:</strong> Normal (1.0x)</p>
            </div>
          </div>

          {/* Buying Tips */}
          <div className="buying-tips">
            <h3>💡 Smart Buying Tips</h3>
            <div className="tips-grid">
              <div className="tip-card">
                <h4>🕐 Best Time to Buy</h4>
                <p>Early morning (6-9 AM) or late night (11 PM+) for lower prices</p>
              </div>
              <div className="tip-card">
                <h4>🛑 Avoid Peak Times</h4>
                <p>7-8 PM prices are highest. Weekend evenings have maximum demand</p>
              </div>
              <div className="tip-card">
                <h4>📈 Smart Strategy</h4>
                <p>Buy on Mondays-Wednesdays morning for better deals than Friday-Saturday</p>
              </div>
              <div className="tip-card">
                <h4>⏰ Event Countdown</h4>
                <p>Last-minute sales surge 24h before event - prices spike then</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
