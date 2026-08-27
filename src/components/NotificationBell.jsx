import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import './NotificationBell.css';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data);
    } catch (err) {
      setNotifications([]);
    }
  };

  // Mark all as read when dropdown is opened
  const handleBellClick = async () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`${API_URL}/notifications/read-all`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Update local state
        setNotifications(notifications.map(n => ({ ...n, read: true })));
      } catch (err) {
        console.warn('Failed to mark notifications as read:', err);
      }
    }
  };

  return (
    <div className="notification-bell-container">
      <button className="notification-bell" onClick={handleBellClick}>
        <span role="img" aria-label="bell">🔔</span>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <h4>Notifications</h4>
          {notifications.length === 0 ? (
            <div className="notification-empty">No notifications</div>
          ) : (
            <ul>
              {notifications.map((n, i) => (
                <li key={i} className={n.read ? '' : 'unread'}>
                  {n.message}
                  <span className="notification-time">{new Date(n.time).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
