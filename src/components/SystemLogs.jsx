import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend
} from 'recharts';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';
import './SystemLogs.css';

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [healthData, setHealthData] = useState({ serviceDistribution: [], errorTimeline: [] });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [refreshKey]);

  const fetchSystemData = async () => {
    try {
      setLoading(true);
      const [logsRes, healthRes] = await Promise.all([
        api.get('/analytics/system-logs'),
        api.get('/analytics/system-health')
      ]);
      setLogs(logsRes.data || []);
      setHealthData(healthRes.data || { serviceDistribution: [], errorTimeline: [] });
    } catch (err) {
      console.error('Failed to fetch system logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

  return (
    <div className="system-logs-dashboard">
      <div className="logs-header">
        <div>
          <h1>System Health Monitoring</h1>
          <p className="text-muted">Real-time distributed tracing and error telemetry</p>
        </div>
        <button className="refresh-btn" onClick={() => setRefreshKey(prev => prev + 1)}>
          🔄 Force Refresh
        </button>
      </div>

      <div className="health-charts-grid">
        {/* Error Timeline Graph */}
        <div className="health-card">
          <h3>📈 Error Frequency (Last 24h)</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={healthData.errorTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ background: '#0a1128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#ef4444' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="errors" 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#ef4444' }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Service Distribution Bar Chart */}
        <div className="health-card">
          <h3>📦 Errors by Service</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={healthData.serviceDistribution} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={100} />
                <Tooltip 
                   cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                   contentStyle={{ background: '#0a1128', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {healthData.serviceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Raw Logs Table */}
      <div className="health-card">
        <h3>📄 Recent Incident Logs</h3>
        <div className="logs-table-container">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Service</th>
                <th>Message</th>
                <th>Trace ID</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td>
                    <span className={`badge-level ${log.level}`}>
                      {log.level}
                    </span>
                  </td>
                  <td>{log.service}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.message}</div>
                    {log.context && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {log.context.method} {log.context.url} ({log.context.statusCode})
                        </div>
                    )}
                  </td>
                  <td>
                    <span className="trace-id">{log.traceId}</span>
                  </td>
                  <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                  <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                          ✨ No critical errors detected in the last 7 days.
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemLogs;
