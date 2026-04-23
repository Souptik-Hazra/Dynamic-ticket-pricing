import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';

const typeIcons = {
  ticket_purchase: '🎫',
  event_update:    '📢',
  price_change:    '💹',
  subscription:    '⭐',
  refund:          '💸',
  system:          '🔔',
  message:         '✉️',
};

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // fetchNotifications handles tokens automatically via the api client

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get(ENDPOINTS.NOTIFICATIONS);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = setTimeout(fetchNotifications, 0);
    return () => clearTimeout(refreshTimer);
  }, [fetchNotifications]);

  // Mark one notification as read
  const markRead = async (id) => {
    try {
      await api.put(ENDPOINTS.NOTIFICATION_READ(id), {});
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silently ignore
    }
  };

  // Mark all as read
  const markAllRead = async () => {
    try {
      await api.put(ENDPOINTS.NOTIFICATIONS_READ_ALL, {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  };

  // Delete one notification
  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(ENDPOINTS.NOTIFICATION_DELETE(id));
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setUnreadCount((c) => {
        const wasUnread = notifications.find((n) => n._id === id && !n.read);
        return wasUnread ? Math.max(0, c - 1) : c;
      });
    } catch {
      // silently ignore
    }
  };

  const formatTime = (ts) => {
    const d    = new Date(ts);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000); // seconds

    if (diff < 60)   return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '4rem 0' }}>
      {/* Header */}
      <header className="flex-between" style={{ marginBottom: '3rem' }}>
        <div className="flex-center" style={{ gap: '1.5rem' }}>
          <h1 className="title-main text-gradient" style={{ margin: 0 }}>NOTIFICATIONS</h1>
          {unreadCount > 0 && (
            <span className="cyber-badge badge-warning" style={{ fontSize: '0.8rem' }}>{unreadCount} UNREAD PULSES</span>
          )}
        </div>
        <div className="flex-center" style={{ gap: '1rem' }}>
          <button className="cyber-btn btn-outline" onClick={fetchNotifications} disabled={loading}>
            🔄 RE-SYNC
          </button>
          {unreadCount > 0 && (
            <button className="cyber-btn btn-primary" onClick={markAllRead}>
              ✅ CLEAR ALL
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      {loading ? (
        <div className="flex-center" style={{ minHeight: '300px' }}>
          <div className="text-glow">INITIALIZING DATA STREAM...</div>
        </div>
      ) : error ? (
        <div className="cyber-badge badge-danger" style={{ padding: '2rem', width: '100%' }}>
          ERR: {error}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex-center" style={{ minHeight: '400px', border: '1px dashed var(--border-dim)', borderRadius: '20px' }}>
          <div className="flex-column" style={{ alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '3rem' }}>📡</span>
            <h3 className="text-main">Neural Link Quiet</h3>
            <p className="text-dim">No incoming transmissions detected in this sector.</p>
          </div>
        </div>
      ) : (
        <div className="flex-column" style={{ gap: '1rem' }}>
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`cyber-card flex-between ${!n.read ? 'text-glow' : ''}`}
              style={{ 
                padding: '1.2rem 2rem', 
                background: !n.read ? 'rgba(79, 172, 254, 0.05)' : 'rgba(10, 17, 40, 0.6)',
                borderLeft: n.type === 'message' ? '4px solid var(--accent-cyan)' : '1px solid var(--border-dim)',
                cursor: !n.read ? 'pointer' : 'default'
              }}
              onClick={() => !n.read && markRead(n._id)}
            >
              <div className="flex-center" style={{ gap: '1.5rem', justifyContent: 'flex-start' }}>
                <div style={{ fontSize: '1.5rem', filter: n.read ? 'grayscale(1)' : 'none' }}>
                  {typeIcons[n.type] || '🔔'}
                </div>
                <div className="flex-column">
                  <div className="text-main" style={{ fontWeight: '800', fontSize: '1rem', color: !n.read ? 'var(--accent-cyan)' : 'var(--text-main)' }}>
                    {n.title?.toUpperCase()}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>{n.message}</div>
                  <div className="text-dim" style={{ fontSize: '0.7rem', marginTop: '0.3rem', fontWeight: '700' }}>
                    TIME_STAMP: {formatTime(n.createdAt)?.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex-center" style={{ gap: '1.5rem' }}>
                {!n.read && <div style={{ width: '8px', height: '8px', background: 'var(--accent-cyan)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent-cyan)' }} />}
                <button
                  className="cyber-btn btn-outline"
                  style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  onClick={(e) => deleteNotification(n._id, e)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Notifications;
