

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import './Analytics.css';
import Footer from './Footer';

function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
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

      {/* Detailed Analytics */}
      <div className="detailed-stats">
        <h2>📊 Detailed Statistics</h2>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Revenue by Category</h3>
            {analytics.revenueByCategory && Object.entries(analytics.revenueByCategory).map(([category, revenue]) => (
              <div key={category} className="stat-row">
                <span>{category}</span>
                <span>₹{revenue.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="stat-card">
            <h3>Popular Events</h3>
            {analytics.topEvents && analytics.topEvents.slice(0, 5).map((event, idx) => (
              <div key={idx} className="stat-row">
                <span>{event.name}</span>
                <span>{event.ticketsSold} tickets</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsWrapper(props) {
  return (
    <>
      <Analytics {...props} />
      <Footer />
    </>
  );
}

