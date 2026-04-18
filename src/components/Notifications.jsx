import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { buildUrl, ENDPOINTS } from '../config/api';
import './Notifications.css';

const typeIcons = {
  ticket_purchase: '🎫',
  event_update:    '📢',
  price_change:    '💹',
  subscription:    '⭐',
  refund:          '💸',
  system:          '🔔',
};

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await axios.get(buildUrl(ENDPOINTS.NOTIFICATIONS), {
        headers: authHeader(),
      });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark one notification as read
  const markRead = async (id) => {
    try {
      await axios.put(buildUrl(ENDPOINTS.NOTIFICATION_READ(id)), {}, { headers: authHeader() });
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
      await axios.put(buildUrl(ENDPOINTS.NOTIFICATIONS_READ_ALL), {}, { headers: authHeader() });
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
      await axios.delete(buildUrl(ENDPOINTS.NOTIFICATION_DELETE(id)), { headers: authHeader() });
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
    <div className="notifications-page">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-title-row">
          <h2>🔔 Notifications</h2>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount} unread</span>
          )}
        </div>
        <div className="notif-actions">
          <button
            className="notif-action-btn"
            onClick={fetchNotifications}
            disabled={loading}
            title="Refresh"
          >
            🔄 Refresh
          </button>
          {unreadCount > 0 && (
            <button className="notif-action-btn mark-all" onClick={markAllRead}>
              ✅ Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="notif-loading">
          <div className="spinner" />
          <p>Loading notifications...</p>
        </div>
      ) : error ? (
        <div className="notif-error">❌ {error}</div>
      ) : notifications.length === 0 ? (
        <div className="notif-empty">
          <div className="notif-empty-icon">🔔</div>
          <h3>No notifications yet</h3>
          <p>We'll notify you about ticket purchases, price changes, and more.</p>
        </div>
      ) : (
        <div className="notif-list">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`notif-item ${!n.read ? 'unread' : ''}`}
              onClick={() => !n.read && markRead(n._id)}
              title={n.read ? '' : 'Click to mark as read'}
            >
              <div className="notif-icon">
                {typeIcons[n.type] || '🔔'}
              </div>
              <div className="notif-body">
                <div className="notif-item-title">{n.title}</div>
                <div className="notif-item-message">{n.message}</div>
                <div className="notif-time">{formatTime(n.createdAt)}</div>
              </div>
              <div className="notif-controls">
                {!n.read && <span className="unread-dot" />}
                <button
                  className="notif-delete-btn"
                  onClick={(e) => deleteNotification(n._id, e)}
                  title="Delete"
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
