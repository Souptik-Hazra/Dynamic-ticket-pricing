import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import './AdminNotificationForm.modern.css';

export default function AdminNotificationForm({ events = [], userGroups = [] }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [target, setTarget] = useState('all');
  const [eventId, setEventId] = useState('');
  const [group, setGroup] = useState('');
  const [priority, setPriority] = useState('normal');
  const [schedule, setSchedule] = useState('');
  const [preview, setPreview] = useState(false);

  const sendNotification = async (e) => {
    e.preventDefault();
    setStatus('');
    try {
      const payload = { message, priority };
      if (target === 'event' && eventId) {
        payload.eventId = eventId;
      }
      if (target === 'group' && group) {
        payload.group = group;
      }
      if (schedule) {
        payload.schedule = schedule;
      }
      await axios.post(`${API_URL}/admin/notify`, payload);
      setStatus('Notification sent!');
      setMessage('');
      setTarget('all');
      setEventId('');
      setGroup('');
      setPriority('normal');
      setSchedule('');
      setPreview(false);
    } catch (err) {
      setStatus('Failed to send notification');
    }
  };

  return (
    <form
      className="admin-notification-form modern-form"
      onSubmit={sendNotification}
    >
      <h2 className="modern-title">
        <span role="img" aria-label="bell" className="modern-bell">🔔</span>
        Send Notification
      </h2>
      <div className="modern-row">
        <div className="modern-col">
          <label className="modern-label">Target</label>
          <select value={target} onChange={e => setTarget(e.target.value)} className="modern-input">
            <option value="all">All Users</option>
            <option value="event">Users of Specific Event</option>
            <option value="group">User Group</option>
          </select>
        </div>
        <div className="modern-col">
          <label className="modern-label">Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} className="modern-input">
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      {target === 'event' && (
        <div className="modern-block">
          <label className="modern-label">Event</label>
          <select value={eventId} onChange={e => setEventId(e.target.value)} className="modern-input" required>
            <option value="">Select Event</option>
            {events.map(ev => (
              <option key={ev._id} value={ev._id}>{ev.name}</option>
            ))}
          </select>
        </div>
      )}
      {target === 'group' && (
        <div className="modern-block">
          <label className="modern-label">Group</label>
          <select value={group} onChange={e => setGroup(e.target.value)} className="modern-input" required>
            <option value="">Select Group</option>
            {userGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="modern-block">
        <label className="modern-label">Schedule (optional)</label>
        <input
          type="datetime-local"
          value={schedule}
          onChange={e => setSchedule(e.target.value)}
          className="modern-input"
          placeholder="dd-mm-yyyy --:-- --"
        />
      </div>
      <div className="modern-block">
        <label className="modern-label">Message</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Enter notification message..."
          required
          className="modern-input"
          style={{minHeight: 80}}
        />
      </div>
      <div className="modern-btn-row">
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className="modern-btn modern-btn-preview"
        >
          Preview
        </button>
        <button
          type="submit"
          className="modern-btn modern-btn-send"
        >
          Send
        </button>
      </div>
      {preview && (
        <div className="modern-preview">
          <strong>Preview:</strong>
          <div className="modern-preview-message">{message || <span className="modern-preview-empty">No message</span>}</div>
          <div className="modern-preview-meta">Priority: {priority}{schedule && ` | Scheduled: ${new Date(schedule).toLocaleString()}`}</div>
        </div>
      )}
      {status && <div className={`notification-status ${status.includes('sent') ? 'modern-status-success' : 'modern-status-fail'}`}>{status}</div>}
    </form>
  );
}
