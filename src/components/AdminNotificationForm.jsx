import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

export default function AdminNotificationForm({ events = [] }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [target, setTarget] = useState('all');
  const [eventId, setEventId] = useState('');

  const sendNotification = async (e) => {
    e.preventDefault();
    setStatus('');
    try {
      const payload = { message };
      if (target === 'event' && eventId) {
        payload.eventId = eventId;
      }
      await axios.post(`${API_URL}/admin/notify`, payload);
      setStatus('Notification sent!');
      setMessage('');
      setTarget('all');
      setEventId('');
    } catch (err) {
      setStatus('Failed to send notification');
    }
  };

  return (
    <form className="admin-notification-form" onSubmit={sendNotification} style={{maxWidth: 400, margin: '0 auto', background: '#f9f9f9', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px #0001'}}>
      <h3 style={{marginBottom: 12}}>Send Notification</h3>
      <div style={{marginBottom: 10}}>
        <label style={{fontWeight: 500}}>Target:</label>
        <select value={target} onChange={e => setTarget(e.target.value)} style={{marginLeft: 8}}>
          <option value="all">All Users</option>
          <option value="event">Users of Specific Event</option>
        </select>
      </div>
      {target === 'event' && (
        <div style={{marginBottom: 10}}>
          <label style={{fontWeight: 500}}>Event:</label>
          <select value={eventId} onChange={e => setEventId(e.target.value)} style={{marginLeft: 8}} required>
            <option value="">Select Event</option>
            {events.map(ev => (
              <option key={ev._id} value={ev._id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Enter notification message..."
        required
        style={{width: '100%', minHeight: 60, marginBottom: 10, borderRadius: 4, border: '1px solid #ccc', padding: 8}}
      />
      <button type="submit" style={{width: '100%', padding: 10, background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer'}}>Send</button>
      {status && <div className="notification-status" style={{marginTop: 10, color: status.includes('sent') ? 'green' : 'red'}}>{status}</div>}
    </form>
  );
}
