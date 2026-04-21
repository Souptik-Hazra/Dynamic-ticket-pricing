import { useState, useEffect } from 'react';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';
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
      const response = await api.get(ENDPOINTS.ANALYTICS_DASHBOARD);
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
      <div className="analytics-loading-container bg-obsidian min-h-screen">
        <div className="loading-spinner"></div>
        <p className="text-glow">Syncing Neural BI Engine...</p>
      </div>
    );
  }

  if (error || !data) {
    const isAccessDenied = error === 403;
    return (
      <div className="analytics-error-container bg-obsidian min-h-screen">
        <div className="error-card glass-panel">
          <h2 className={isAccessDenied ? 'text-red-400' : 'text-cyan-400'}>
            {isAccessDenied ? 'Restricted Access' : 'Engine Link Failure'}
          </h2>
          <p>
            {isAccessDenied 
              ? 'Unauthorized personnel detected. Admin or Organizer credentials required for BI access.' 
              : 'Failed to establish encrypted link with Analytics Microservice. Ensure service is operational on port 4011.'}
          </p>
          <button 
            onClick={fetchDashboardData}
            className="btn-premium mt-6"
          >
            Reconnect Terminal
          </button>
        </div>
      </div>
    );
  }

  const { summary, trends, categories, venues } = data;

  // Helper to calculate percentage for leaderboard bars
  const getMaxRevenue = (arr) => Math.max(...arr.map(i => i.revenue || 0), 1);

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2>Neural BI Analytics</h2>
        <p>Market intelligence and event performance metrics</p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="card-icon">⚡</div>
          <div className="card-content">
            <h3>Live Operations</h3>
            <p className="stat-value">{summary.totalEvents}</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">💎</div>
          <div className="card-content">
            <h3>Aggregate Revenue</h3>
            <p className="stat-value">₹{summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">🎯</div>
          <div className="card-content">
            <h3>Yield Efficiency</h3>
            <p className="stat-value">{(summary.avgOccupancy * 100).toFixed(1)}%</p>
          </div>
        </div>
        <div className="analytics-card">
          <div className="card-icon">🌐</div>
          <div className="card-content">
            <h3>Global Footprint</h3>
            <p className="stat-value">{venues.length} Sectors</p>
          </div>
        </div>
      </div>

      <div className="dashboard-main-content">
        <TrendChart data={trends} />

        <div className="bi-grid-row">
          {/* Category Distribution Leaderboard */}
          <div className="bi-widget">
            <div className="bi-widget-header">
              <h3><span>📊</span> Category Saturation</h3>
              <span className="badge">Revenue Split</span>
            </div>
            <div className="leaderboard-container">
              {categories.map((cat, idx) => (
                <div key={idx} className="leaderboard-item">
                  <div className="leaderboard-label">
                    <span className="leaderboard-name">
                      {cat.name} <span className="sub">[{cat.count} Events]</span>
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
              <h3><span>🏙️</span> Sector Performance</h3>
              <span className="badge">Yield Index</span>
            </div>
            <div className="leaderboard-container">
              {venues.map((venue, idx) => (
                <div key={idx} className="leaderboard-item">
                  <div className="leaderboard-label">
                    <span className="leaderboard-name">
                      {venue.name} <span className="sub">[{venue.count} Nodes]</span>
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
  return <Analytics {...props} />;
}
