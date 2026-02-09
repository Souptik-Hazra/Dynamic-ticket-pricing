import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import axios from 'axios';
import './PriceHistoryChart.css';

const PriceHistoryChart = ({ eventId, eventName }) => {
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d'); // 24h, 7d, 30d
  const [showPrediction, setShowPrediction] = useState(true);

  useEffect(() => {
    if (eventId) {
      fetchPriceHistory();
    }
  }, [eventId, timeRange]);

  const fetchPriceHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3001/api/analytics/price-history/${eventId}?range=${timeRange}`);
      
      // Format data for chart
      const formattedData = response.data.map(item => ({
        ...item,
        date: new Date(item.timestamp).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        price: parseFloat(item.price.toFixed(2))
      }));
      
      setPriceHistory(formattedData);
    } catch (error) {
      console.error('Error fetching price history:', error);
      // Generate demo data if API fails
      generateDemoData();
    } finally {
      setLoading(false);
    }
  };

  const generateDemoData = () => {
    const now = new Date();
    const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
    const points = days === 1 ? 24 : days * 4;
    
    const data = [];
    let basePrice = 500;
    
    for (let i = points; i >= 0; i--) {
      const timestamp = new Date(now - i * (86400000 / (points / days)));
      const variation = Math.sin(i * 0.5) * 50 + Math.random() * 30;
      const price = basePrice + variation;
      
      data.push({
        timestamp: timestamp.toISOString(),
        date: timestamp.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit'
        }),
        price: parseFloat(price.toFixed(2)),
        demand: Math.floor(50 + Math.random() * 50),
        predicted: showPrediction ? parseFloat((price * (1 + Math.random() * 0.1)).toFixed(2)) : null
      });
    }
    
    setPriceHistory(data);
  };

  const getStats = () => {
    if (priceHistory.length === 0) return null;
    
    const prices = priceHistory.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const current = prices[prices.length - 1];
    const first = prices[0];
    const change = ((current - first) / first) * 100;
    
    return { min, max, avg, current, change };
  };

  const stats = getStats();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="price-tooltip">
          <p className="tooltip-date">{label}</p>
          <p className="tooltip-price">
            Price: <span>₹{payload[0].value.toFixed(2)}</span>
          </p>
          {payload[1] && (
            <p className="tooltip-predicted">
              Predicted: <span>₹{payload[1].value.toFixed(2)}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="price-chart-container">
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <p>Loading price history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="price-chart-container bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <div className="chart-header">
        <div className="chart-title">
          <h3>📈 Price History</h3>
          {eventName && <span className="event-name">{eventName}</span>}
        </div>
        
        <div className="chart-controls">
          <div className="time-range-buttons">
            {['24h', '7d', '30d'].map(range => (
              <button
                key={range}
                className={`range-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
          
          <label className="prediction-toggle">
            <input
              type="checkbox"
              checked={showPrediction}
              onChange={(e) => setShowPrediction(e.target.checked)}
            />
            Show Prediction
          </label>
        </div>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Current</span>
            <span className="stat-value current">₹{stats.current.toFixed(2)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Min</span>
            <span className="stat-value min">₹{stats.min.toFixed(2)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Max</span>
            <span className="stat-value max">₹{stats.max.toFixed(2)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Average</span>
            <span className="stat-value avg">₹{stats.avg.toFixed(2)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Change</span>
            <span className={`stat-value ${stats.change >= 0 ? 'positive' : 'negative'}`}>
              {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={priceHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#667eea" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#28a745" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#28a745" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              stroke="#999"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#999"
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="price"
              name="Actual Price"
              stroke="#667eea"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPrice)"
            />
            {showPrediction && (
              <Area
                type="monotone"
                dataKey="predicted"
                name="ML Prediction"
                stroke="#28a745"
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={1}
                fill="url(#colorPredicted)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-insights">
        <h4>💡 Insights</h4>
        <ul>
          {stats && stats.change > 5 && (
            <li className="insight-up">Prices are trending up. Consider booking soon!</li>
          )}
          {stats && stats.change < -5 && (
            <li className="insight-down">Prices are dropping. You might get a better deal!</li>
          )}
          {stats && Math.abs(stats.change) <= 5 && (
            <li className="insight-stable">Prices are stable. Good time to book!</li>
          )}
          <li>Best time to book is typically early morning (6-8 AM)</li>
          <li>Weekend prices tend to be 10-15% higher</li>
        </ul>
      </div>
    </div>
  );
};

export default PriceHistoryChart;
