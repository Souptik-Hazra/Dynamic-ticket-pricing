
import { useState, useEffect } from 'react';
import axios from 'axios';
import { buildUrl, ENDPOINTS } from '../config/api';
import TrendChart from './TrendChart';
import './Analytics.css';

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await axios.get(buildUrl(ENDPOINTS.ANALYTICS_DASHBOARD), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setData(response.data);
    } catch (err) {
      console.error('Error fetching analytics dashboard:', err);
      setError(err.response?.status || 500);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading-container bg-white dark:bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
        <p className="ml-4 text-gray-500">Processing Business Intelligence...</p>
      </div>
    );
  }

  if (error || !data) {
    const isAccessDenied = error === 403;
    return (
      <div className="analytics-error-container min-h-screen flex items-center justify-center">
        <div className={`error-card p-8 rounded-xl text-center ${isAccessDenied ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
          <h2 className={`font-bold mb-2 ${isAccessDenied ? 'text-red-600' : 'text-orange-600'}`}>
            {isAccessDenied ? 'Access Denied' : 'Service Temporarily Offline'}
          </h2>
          <p className={isAccessDenied ? 'text-red-500' : 'text-orange-500'}>
            {isAccessDenied 
              ? 'Analytics are reserved for Administrators and Organizers.' 
              : 'We encountered an error reaching the BI Engine. Please verify that the Analytics Service is running.'}
          </p>
          <button 
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { summary, trends, categories, venues } = data;

  // Helper to calculate percentage for leaderboard bars
  const getMaxRevenue = (arr) => Math.max(...arr.map(i => i.revenue), 1);

  return (
    <div className="analytics-container min-h-screen pb-12">
      <div className="analytics-header">
        <h2>Business Intelligence Dashboard</h2>
        <p>Real-time performance metrics and market trends</p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="card-icon">🎭</div>
          <div className="card-content">
            <h3>Active Events</h3>
            <p className="stat-value">{summary.totalEvents}</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <h3>Gross Revenue</h3>
            <p className="stat-value">₹{summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">📈</div>
          <div className="card-content">
            <h3>Avg. Occupancy</h3>
            <p className="stat-value">{(summary.avgOccupancy * 100).toFixed(1)}%</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">🏢</div>
          <div className="card-content">
            <h3>Venue Reach</h3>
            <p className="stat-value">{venues.length} Locations</p>
          </div>
        </div>
      </div>

      <div className="dashboard-main-content mt-8">
        <TrendChart data={trends} />

        <div className="bi-grid-row mt-8">
          {/* Category Distribution Leaderboard */}
          <div className="bi-widget">
            <div className="bi-widget-header">
              <h3><span>🧩</span> Revenue by Category</h3>
              <span className="badge">Market Share</span>
            </div>
            <div className="leaderboard-container">
              {categories.map((cat, idx) => (
                <div key={idx} className="leaderboard-item">
                  <div className="leaderboard-label">
                    <span className="leaderboard-name">
                      {cat.name} <span className="sub">({cat.count} Events)</span>
                    </span>
                    <span className="leaderboard-val">₹{cat.revenue.toLocaleString()}</span>
                  </div>
                  <div className="leaderboard-bar-bg">
                    <div 
                      className="leaderboard-bar-fill" 
                      style={{ width: `${(cat.revenue / getMaxRevenue(categories)) * 100}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Venues Leaderboard */}
          <div className="bi-widget">
            <div className="bi-widget-header">
              <h3><span>📍</span> High Performance Venues</h3>
              <span className="badge">Yield Efficiency</span>
            </div>
            <div className="leaderboard-container">
              {venues.map((venue, idx) => (
                <div key={idx} className="leaderboard-item">
                  <div className="leaderboard-label">
                    <span className="leaderboard-name">
                      {venue.name} <span className="sub">({venue.count} Events)</span>
                    </span>
                    <span className="leaderboard-val">₹{venue.revenue.toLocaleString()}</span>
                  </div>
                  <div className="leaderboard-bar-bg">
                    <div 
                      className="leaderboard-bar-fill accent-pink" 
                      style={{ width: `${(venue.revenue / getMaxRevenue(venues)) * 100}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
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
    </>
  );
}
