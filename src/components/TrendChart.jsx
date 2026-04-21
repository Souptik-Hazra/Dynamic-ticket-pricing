import React from 'react';
import './TrendChart.css';

const TrendChart = ({ data = [], title = "Sales Volume & Revenue" }) => {
  // Ensure we have at least one day or handle empty state
  if (!data || data.length === 0) {
    return (
      <div className="trend-chart-container empty-state-chart">
        <div className="empty-chart-visual">
          <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none">
             <defs>
               <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                 <stop offset="0%" stopColor="rgba(79, 172, 254, 0.1)" />
                 <stop offset="50%" stopColor="rgba(79, 172, 254, 0.4)" />
                 <stop offset="100%" stopColor="rgba(79, 172, 254, 0.1)" />
               </linearGradient>
             </defs>
             <path d="M0,120 C50,110 100,130 150,100 S250,80 300,110 S350,90 400,100" 
                   fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeDasharray="10 5" />
             <rect x="40" y="90" width="16" height="30" rx="4" fill="rgba(255,255,255,0.03)" />
             <rect x="100" y="60" width="16" height="60" rx="4" fill="rgba(255,255,255,0.04)" />
             <rect x="160" y="100" width="16" height="20" rx="4" fill="rgba(255,255,255,0.02)" />
             <rect x="220" y="40" width="16" height="80" rx="4" fill="rgba(111,111,111,0.05)" />
          </svg>
        </div>
        <div className="empty-chart-text">
          <h3>{title}</h3>
          <p>No transactions detected in the specified timeframe. Start selling tickets to see real-time performance analytics.</p>
        </div>
      </div>
    );
  }

  // Find max values for scaling with a safe floor
  const maxRevenue = Math.max(...data.map(d => d.revenue || 0), 1);
  const maxCount = Math.max(...data.map(d => d.count || 0), 1);

  // Helper to format date for x-axis
  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    } catch (e) { return dateStr; }
  };

  return (
    <div className="trend-chart-container">
      <div className="chart-header">
        <h3>{title}</h3>
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-indicator indicator-revenue"></span>
            Revenue (₹)
          </div>
          <div className="legend-item">
            <span className="legend-indicator indicator-count"></span>
            Quantity
          </div>
        </div>
      </div>

      <div className="chart-bars-wrapper">
        {data.map((item, idx) => {
          // Add a minimum 3% height so very small values remain visible
          const revenueHeight = Math.max((item.revenue / maxRevenue) * 100, 3);
          const countHeight = Math.max((item.count / maxCount) * 100, 3);

          return (
            <div key={idx} className="chart-column">
              <div 
                className="bar-revenue" 
                style={{ height: `${revenueHeight}%` }}
              ></div>
              <div 
                className="bar-count" 
                style={{ height: `${countHeight}%` }}
              ></div>
              
              <div className="x-axis-label">{formatDate(item.date)}</div>

              <div className="chart-tooltip">
                <strong>{new Date(item.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
                <div style={{ color: 'var(--bi-accent-cyan)', marginBottom: '4px' }}>
                  Revenue: ₹{item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ color: 'var(--bi-accent-pink)' }}>
                  Sales: {item.count} tickets sold
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrendChart;