import { useState, useEffect } from 'react';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';
import TrendChart from './TrendChart';

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const refreshTimer = setTimeout(fetchDashboardData, 0);
    return () => clearTimeout(refreshTimer);
  }, []);

  async function fetchDashboardData() {
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
  }

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
      <div className="flex-center" style={{ minHeight: '80vh', padding: '2rem' }}>
        <div className="cyber-card" style={{ maxWidth: '500px', textAlign: 'center', borderTop: `4px solid ${isAccessDenied ? 'var(--danger)' : 'var(--accent-cyan)'}` }}>
          <h2 className={isAccessDenied ? 'text-glow' : 'text-main'} style={{ color: isAccessDenied ? 'var(--danger)' : 'var(--accent-cyan)' }}>
            {isAccessDenied ? '❌ RESTRICTED SECTOR' : '⚠️ ENGINE LINK FAILURE'}
          </h2>
          <p className="text-dim" style={{ margin: '1.5rem 0' }}>
            {isAccessDenied 
              ? 'Unauthorized personnel detected. Admin or Organizer credentials required for BI access.' 
              : 'Failed to establish encrypted link with Analytics Microservice. Ensure service is operational on port 4011.'}
          </p>
          <button 
            onClick={fetchDashboardData}
            className="cyber-btn btn-primary"
            style={{ width: '100%' }}
          >
            RECONNECT TERMINAL
          </button>
        </div>
      </div>
    );
  }

  const { summary, trends, categories, venues } = data;

  // Helper to calculate percentage for leaderboard bars
  const getMaxRevenue = (arr) => Math.max(...arr.map(i => i.revenue || 0), 1);

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '2rem 0' }}>
      <header className="flex-between" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 className="title-main text-gradient" style={{ margin: 0 }}>🧠 NEURAL BI ANALYTICS</h1>
          <p className="text-muted">High-fidelity market intelligence and performance telemetry.</p>
        </div>
        <div className="flex-center" style={{ gap: '1rem' }}>
          <span className="cyber-badge badge-success">● SYSTEM ONLINE</span>
          <button className="cyber-btn btn-outline" onClick={fetchDashboardData}>🔄 RE-SYNC</button>
        </div>
      </header>

      <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
        <div className="cyber-card flex-center" style={{ gap: '1rem', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem' }}>⚡</div>
          <div className="flex-column">
            <span className="cyber-label" style={{ fontSize: '0.6rem' }}>LIVE OPERATIONS</span>
            <span className="text-glow" style={{ fontSize: '1.4rem', fontWeight: '900' }}>{summary.totalEvents}</span>
          </div>
        </div>
        <div className="cyber-card flex-center" style={{ gap: '1rem', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem' }}>💎</div>
          <div className="flex-column">
            <span className="cyber-label" style={{ fontSize: '0.6rem' }}>AGGREGATE REVENUE</span>
            <span className="text-glow" style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--success)' }}>
              ₹{summary.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
        <div className="cyber-card flex-center" style={{ gap: '1rem', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem' }}>🎯</div>
          <div className="flex-column">
            <span className="cyber-label" style={{ fontSize: '0.6rem' }}>YIELD EFFICIENCY</span>
            <span className="text-glow" style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--accent-cyan)' }}>
              {(summary.avgOccupancy * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="cyber-card flex-center" style={{ gap: '1rem', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem' }}>🌐</div>
          <div className="flex-column">
            <span className="cyber-label" style={{ fontSize: '0.6rem' }}>GLOBAL SECTORS</span>
            <span className="text-glow" style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--accent-indigo)' }}>
              {venues.length}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-column" style={{ gap: '3rem' }}>
        <TrendChart data={trends} />

        <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          {/* Category Distribution Leaderboard */}
          <div className="cyber-card" style={{ padding: '2rem' }}>
            <div className="flex-between" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-dim)', paddingBottom: '1rem' }}>
              <h3 className="cyber-label" style={{ fontSize: '1rem' }}>📊 CATEGORY SATURATION</h3>
              <span className="cyber-badge">REVENUE SPLIT</span>
            </div>
            <div className="flex-column" style={{ gap: '1.5rem' }}>
              {categories.map((cat, idx) => (
                <div key={idx} className="flex-column" style={{ gap: '0.6rem' }}>
                  <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                    <span className="text-main" style={{ fontWeight: '700' }}>
                      {cat.name} <span className="text-dim" style={{ fontWeight: '400', fontSize: '0.75rem' }}>[{cat.count} Events]</span>
                    </span>
                    <span className="text-glow" style={{ color: 'var(--accent-cyan)' }}>₹{cat.revenue.toLocaleString()}</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-deep)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${(cat.revenue / getMaxRevenue(categories)) * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))',
                        boxShadow: '0 0 10px rgba(79, 172, 254, 0.3)'
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Venues Leaderboard */}
          <div className="cyber-card" style={{ padding: '2rem' }}>
            <div className="flex-between" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-dim)', paddingBottom: '1rem' }}>
              <h3 className="cyber-label" style={{ fontSize: '1rem' }}>🏙️ SECTOR PERFORMANCE</h3>
              <span className="cyber-badge">YIELD INDEX</span>
            </div>
            <div className="flex-column" style={{ gap: '1.5rem' }}>
              {venues.map((venue, idx) => (
                <div key={idx} className="flex-column" style={{ gap: '0.6rem' }}>
                  <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                    <span className="text-main" style={{ fontWeight: '700' }}>
                      {venue.name} <span className="text-dim" style={{ fontWeight: '400', fontSize: '0.75rem' }}>[{venue.count} Nodes]</span>
                    </span>
                    <span className="text-glow" style={{ color: 'var(--accent-pink)' }}>₹{venue.revenue.toLocaleString()}</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-deep)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${(venue.revenue / getMaxRevenue(venues)) * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--accent-pink), #f5576c)',
                        boxShadow: '0 0 10px rgba(240, 147, 251, 0.3)'
                      }} 
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
