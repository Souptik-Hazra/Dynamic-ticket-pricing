import React from 'react';
import './TrendChart.css';

const TrendChart = ({ data = [], title = "Sales Growth (Last 30 Days)" }) => {
  if (!data || data.length === 0) {
    return (
      <div className="trend-chart-container empty-state-chart">
        <div className="empty-chart-visual">
          <svg width="100%" height="120" viewBox="0 0 400 120" preserveAspectRatio="none">
             <path d="M0,100 C50,100 100,100 150,100 S250,100 300,100 S350,100 400,100" 
                   fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" strokeDasharray="8 4" />
             <rect x="40" y="80" width="20" height="20" rx="4" fill="rgba(255,255,255,0.03)" />
             <rect x="100" y="60" width="20" height="40" rx="4" fill="rgba(255,255,255,0.03)" />
             <rect x="160" y="90" width="20" height="10" rx="4" fill="rgba(255,255,255,0.03)" />
          </svg>
        </div>
        <div className="empty-chart-text">
          <h3>{title}</h3>
          <p>The platform is warming up. Real-time trends will appear here as soon as orders are confirmed.</p>
        </div>
      </div>
    );
  }

  // Find max values for scaling
  const maxRevenue = Math.max(...data.map(d => d.revenue || 0), 100);
  const maxCount = Math.max(...data.map(d => d.count || 0), 1);

  // Helper to format date for x-axis
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
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
            Tickets
          </div>
        </div>
      </div>

      <div className="chart-bars-wrapper">
        {data.map((item, idx) => {
          const revenueHeight = (item.revenue / maxRevenue) * 100;
          const countHeight = (item.count / maxCount) * 100;

          return (
            <div key={idx} className="chart-column">
              <div 
                className="bar-revenue" 
                style={{ height: `${Math.max(revenueHeight, 2)}%` }}
              ></div>
              <div 
                className="bar-count" 
                style={{ height: `${Math.max(countHeight, 2)}%` }}
              ></div>
              
              <div className="x-axis-label">{formatDate(item.date)}</div>

              <div className="chart-tooltip">
                <strong>{new Date(item.date).toDateString()}</strong>
                <div>Revenue: ₹{item.revenue.toLocaleString()}</div>
                <div>Sold: {item.count} tickets</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrendChart;
