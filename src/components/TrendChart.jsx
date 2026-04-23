import React from 'react';

const TrendChart = ({ data = [], title = "Sales Volume & Revenue" }) => {
  // Ensure we have at least one day or handle empty state
  if (!data || data.length === 0) {
    return (
      <div className="cyber-card flex-center flex-column" style={{ padding: '4rem', textAlign: 'center', minHeight: '300px' }}>
        <div className="text-glow animate-pulse" style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>📉</div>
        <h3 className="text-main">{title}</h3>
        <p className="text-dim" style={{ maxWidth: '400px' }}>No transactional data streams detected in the specified timeframe.</p>
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
    } catch { return dateStr; }
  };

  return (
    <div className="cyber-card" style={{ padding: '2rem' }}>
      <div className="flex-between" style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border-dim)', paddingBottom: '1rem' }}>
        <h3 className="cyber-label" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>{title}</h3>
        <div className="flex-center" style={{ gap: '1.5rem' }}>
          <div className="flex-center" style={{ gap: '0.5rem' }}>
            <span style={{ width: '12px', height: '4px', background: 'var(--accent-cyan)', borderRadius: '2px' }}></span>
            <span className="text-dim" style={{ fontSize: '0.75rem' }}>Revenue (₹)</span>
          </div>
          <div className="flex-center" style={{ gap: '0.5rem' }}>
            <span style={{ width: '12px', height: '4px', background: 'var(--accent-pink)', borderRadius: '2px' }}></span>
            <span className="text-dim" style={{ fontSize: '0.75rem' }}>Quantity</span>
          </div>
        </div>
      </div>

      <div className="flex-center" style={{ height: '280px', alignItems: 'flex-end', gap: '1rem', overflowX: 'auto', paddingBottom: '3rem' }}>
        {data.map((item, idx) => {
          const revenueHeight = Math.max((item.revenue / maxRevenue) * 100, 4);
          const countHeight = Math.max((item.count / maxCount) * 100, 4);

          return (
            <div key={idx} className="flex-center" style={{ flex: 1, minWidth: '40px', height: '100%', alignItems: 'flex-end', gap: '4px', position: 'relative' }}>
              <div 
                style={{ 
                  width: '12px', 
                  height: `${revenueHeight}%`, 
                  background: 'linear-gradient(180deg, var(--accent-cyan), var(--accent-blue))',
                  borderRadius: '4px 4px 0 0',
                  boxShadow: '0 4px 15px rgba(79, 172, 254, 0.2)',
                  transition: 'height 0.8s ease-out'
                }} 
              ></div>
              <div 
                style={{ 
                  width: '12px', 
                  height: `${countHeight}%`, 
                  background: 'linear-gradient(180deg, var(--accent-pink), #f5576c)',
                  borderRadius: '4px 4px 0 0',
                  boxShadow: '0 4px 15px rgba(240, 147, 251, 0.2)',
                  transition: 'height 0.8s ease-out'
                }} 
              ></div>
              
              <div className="text-dim" style={{ position: 'absolute', bottom: '-25px', fontSize: '0.65rem', whiteSpace: 'nowrap', transform: 'rotate(-45deg)' }}>
                {formatDate(item.date)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrendChart;
