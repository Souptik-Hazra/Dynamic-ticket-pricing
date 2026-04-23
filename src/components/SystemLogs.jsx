import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, Legend
} from 'recharts';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [healthData, setHealthData] = useState({ serviceDistribution: [], errorTimeline: [] });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  async function fetchSystemData() {
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
  }

  useEffect(() => {
    const refreshTimer = setTimeout(fetchSystemData, 0);
    const interval = setInterval(fetchSystemData, 30000); // Auto-refresh every 30s
    return () => {
      clearTimeout(refreshTimer);
      clearInterval(interval);
    };
  }, [refreshKey]);

  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '4rem 0' }}>
      <div className="flex-between" style={{ marginBottom: '3rem' }}>
        <div>
          <h1 className="title-main text-gradient" style={{ margin: 0, fontSize: '2.5rem' }}>System Health Monitor</h1>
          <p className="text-dim">Real-time distributed tracing and neural telemetry</p>
        </div>
        <button className="cyber-btn btn-outline" onClick={() => setRefreshKey(prev => prev + 1)} disabled={loading}>
          🔄 System Check
        </button>
      </div>

      <div className="cyber-grid" style={{ gridTemplateColumns: '1.5fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
        {/* Error Timeline Graph */}
        <div className="cyber-card">
          <h3 className="cyber-label" style={{ marginBottom: '1.5rem', color: 'var(--danger)' }}>📈 Error Frequency (Last 24h)</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={healthData.errorTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="var(--text-dim)" fontSize={12} />
                <YAxis stroke="var(--text-dim)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                  itemStyle={{ color: 'var(--danger)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="errors" 
                  stroke="var(--danger)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: 'var(--danger)' }}
                  activeDot={{ r: 8, stroke: 'white', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Service Distribution Bar Chart */}
        <div className="cyber-card">
          <h3 className="cyber-label" style={{ marginBottom: '1.5rem', color: 'var(--accent-cyan)' }}>📦 Distribution per Sector</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={healthData.serviceDistribution} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="var(--text-dim)" fontSize={10} width={100} />
                <Tooltip 
                   cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                   contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: '12px' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {healthData.serviceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Raw Logs Table */}
      <div className="cyber-card">
        <h3 className="cyber-label" style={{ marginBottom: '1.5rem' }}>📄 Recent Incident Logs</h3>
        <div className="cyber-table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Service</th>
                <th>Protocol Message</th>
                <th>Trace ID</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td>
                    <span className={`cyber-badge badge-${log.level === 'CRITICAL' ? 'danger' : log.level === 'WARN' ? 'warning' : 'danger'}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="text-main" style={{ fontWeight: '700' }}>{log.service}</td>
                  <td>
                    <div className="text-main" style={{ fontWeight: '800' }}>{log.message}</div>
                    {log.context && (
                        <div className="text-dim" style={{ fontSize: '0.75rem' }}>
                            {log.context.method} {log.context.url} ({log.context.statusCode})
                        </div>
                    )}
                  </td>
                  <td>
                    <code className="text-glow" style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>{log.traceId}</code>
                  </td>
                  <td>
                    <span className="text-dim" style={{ fontSize: '0.8rem' }}>{new Date(log.timestamp).toLocaleString()}</span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                  <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '5rem' }}>
                          <span className="text-glow">✨ All neural channels are optimal. No incidents detected.</span>
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
