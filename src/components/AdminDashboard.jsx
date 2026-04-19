import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AdminEventForm from './AdminEventForm';
import Footer from './Footer';
import { buildUrl, ENDPOINTS } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';
import './AdminDashboard.css';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const { connected, lastEvent } = useWebSocket();
  const [view, setView]   = useState('stats');
  const [stats, setStats] = useState(null);
  const [events, setEvents]               = useState([]);
  const [tickets, setTickets]             = useState([]);
  const [users, setUsers]                 = useState([]);
  const [commissions, setCommissions]     = useState([]);
  const [loading, setLoading]             = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent]   = useState(null);
  const [userSearch, setUserSearch]       = useState(''); 
  const [eventSearch, setEventSearch]     = useState(''); 
  const [roleFilter, setRoleFilter]         = useState('all');
  const [adminWallet, setAdminWallet]     = useState({ balance: 0 });
  const [messageForm, setMessageForm]     = useState({ target: 'all_users', targetId: '', title: '', message: '' });
  const [healthData, setHealthData]       = useState({ services: {}, loading: false });

  // Real-time: refresh stats when a ticket is sold
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'ticket_sold' && view === 'stats') {
      fetchStats();
    }
  }, [lastEvent]); // eslint-disable-line

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  useEffect(() => {
    if (view === 'stats')   fetchStats();
    if (view === 'events')  fetchEvents();
    if (view === 'tickets') fetchTickets();
    if (view === 'users')   fetchUsers();
    if (view === 'organizers') fetchCommissions();
    if (view === 'diagnostics') fetchPlatformHealth();
    fetchAdminWallet();
  }, [view]);

  const fetchPlatformHealth = async () => {
    try {
      setHealthData(prev => ({ ...prev, loading: true }));
      const { data } = await axios.get(buildUrl(ENDPOINTS.PLATFORM_HEALTH), authHeaders());
      setHealthData({ services: data.services || {}, loading: false });
    } catch (err) {
      console.error('Health check error:', err);
      setHealthData(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchAdminWallet = async () => {
    try {
      const { data } = await axios.get(buildUrl(ENDPOINTS.WALLET_BALANCE), authHeaders());
      setAdminWallet(data);
    } catch (err) { console.error('Admin wallet error:', err); }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(buildUrl(ENDPOINTS.ADMIN_STATS), authHeaders());
      setStats(data.stats);
    } catch (err) {
      console.error('Stats error:', err);
      alert('Failed to fetch statistics');
    } finally { setLoading(false); }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(buildUrl(ENDPOINTS.ADMIN_EVENTS), authHeaders());
      setEvents(data.events);
    } catch (err) {
      console.error('Events error:', err);
      alert('Failed to fetch events');
    } finally { setLoading(false); }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(buildUrl(ENDPOINTS.ADMIN_TICKETS), authHeaders());
      setTickets(data.tickets);
    } catch (err) {
      console.error('Tickets error:', err);
      alert('Failed to fetch tickets');
    } finally { setLoading(false); }
  };


  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(buildUrl(ENDPOINTS.ADMIN_COMMISSIONS), authHeaders());
      setCommissions(data.commissions || []);
    } catch (err) {
      console.error('Commissions error:', err);
    } finally { setLoading(false); }
  };

  const handleCompleteEvent = async (eventId) => {
    if (!window.confirm('Mark this event as COMPLETED and process 20% commission? This action is irreversible.')) return;
    try {
      setLoading(true);
      await axios.post(buildUrl(`${ENDPOINTS.ADMIN_EVENTS}/${eventId}/complete`), {}, authHeaders());
      alert('Event completed and commission transferred!');
      fetchEvents();
      fetchAdminWallet();
    } catch (err) {
      console.error('Completion error:', err);
      alert(err.response?.data?.error || 'Failed to complete event');
    } finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(buildUrl(ENDPOINTS.ADMIN_USERS), authHeaders());
      setUsers(data.users || []);
    } catch (err) {
      console.error('Users error:', err);
      alert('Failed to fetch users');
    } finally { setLoading(false); }
  };

  const handleRoleUpdate = async (userId, newRole) => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) return;
    try {
      setLoading(true);
      await axios.put(buildUrl(`${ENDPOINTS.ADMIN_USERS}/${userId}/role`), { role: newRole }, authHeaders());
      alert('Role updated successfully!');
      fetchUsers();
    } catch (err) {
      console.error('Role update error:', err);
      alert(err.response?.data?.error || 'Failed to update role');
    } finally { setLoading(false); }
  };

  const handleDirectMessage = (userId) => {
    setMessageForm({ ...messageForm, target: 'individual', targetId: userId, title: '', message: '' });
    setView('communication');
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!messageForm.title || !messageForm.message) return alert('Title and message required');
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      await axios.post(buildUrl(ENDPOINTS.ADMIN_BROADCAST), messageForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Broadcast dispatched successfully!');
      setMessageForm({ ...messageForm, title: '', message: '' });
    } catch (err) {
      console.error('Broadcast error:', err);
      alert(err.response?.data?.error || 'Failed to send broadcast');
    } finally { setLoading(false); }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await axios.delete(buildUrl(`${ENDPOINTS.ADMIN_EVENTS}/${eventId}`), authHeaders());
      fetchEvents();
      fetchAdminWallet();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete event');
    }
  };

  const handleEventFormClose = (refresh) => {
    setShowEventForm(false);
    setEditingEvent(null);
    if (refresh) fetchEvents();
  };

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const getAvatarColor = (name) => {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '?';
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(userSearch.toLowerCase()) || 
                          u.email?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>🎫 Admin Dashboard</h1>
          <span className={`ws-indicator ${connected ? 'ws-on' : 'ws-off'}`}
                title={connected ? 'Live updates connected' : 'Offline'}>
            {connected ? '🟢 Live' : '⚫ Offline'}
          </span>
          <div className="admin-wallet-badge" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            🏢 Platform: ₹{adminWallet.balance.toFixed(2)}
          </div>
        </div>
      </header>

      <nav className="admin-nav">
        <button className={view === 'stats'   ? 'active' : ''} onClick={() => setView('stats')}>📊 Statistics</button>
        <button className={view === 'events'  ? 'active' : ''} onClick={() => setView('events')}>🎭 Manage Events</button>
        <button className={view === 'tickets' ? 'active' : ''} onClick={() => setView('tickets')}>🎟️ Ticket Buyers</button>
        <button className={view === 'users'   ? 'active' : ''} onClick={() => setView('users')}>👥 Users</button>
        <button className={view === 'organizers' ? 'active' : ''} onClick={() => setView('organizers')}>🏢 Organizers</button>
        <button className={view === 'communication' ? 'active' : ''} onClick={() => setView('communication')}>📢 Communication</button>
        <button className={view === 'diagnostics' ? 'active' : ''} onClick={() => setView('diagnostics')}>🩺 Platform Health</button>
      </nav>

      <main className="admin-content">
        {loading && <div className="loading">Loading...</div>}

        {/* ── Diagnostics / Service Pulse ─────────────────────────────────── */}
        {view === 'diagnostics' && (
          <div className="diagnostics-view">
            <div className="view-header">
              <h2>🩺 Technical Health Monitor (System Pulse)</h2>
              <p className="view-subtitle">Real-time status of the 14 microservices architecture</p>
              <button className="refresh-btn" onClick={fetchPlatformHealth} disabled={healthData.loading}>
                {healthData.loading ? '🔄 Checking...' : '🔄 Refresh All'}
              </button>
            </div>

            <div className="pulse-grid">
              {Object.entries(healthData.services).map(([name, data]) => (
                <div key={name} className={`pulse-card ${(['online', 'ok', 'healthy'].includes(data.status)) ? 'online' : data.status}`}>
                  <div className="pulse-header">
                    <span className="service-name">{name.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                    <span className={`status-pill ${(['online', 'ok', 'healthy'].includes(data.status)) ? 'online' : data.status}`}>{data.status.toUpperCase()}</span>
                  </div>
                  <div className="pulse-body">
                    {(['online', 'ok', 'healthy'].includes(data.status)) ? (
                      <>
                        <div className="pulse-metric"><span className="label">Latency:</span> <span className="value latency">{data.latency}</span></div>
                        <div className="pulse-metric"><span className="label">Uptime:</span> <span className="value">Verified</span></div>
                        {data.model_version && <div className="pulse-metric"><span className="label">Model:</span> <span className="value" style={{fontSize: '0.7rem'}}>{data.model_version}</span></div>}
                        {data.model_loaded !== undefined && <div className="pulse-metric"><span className="label">Loaded:</span> <span className="value">{data.model_loaded ? '✅' : '❌'}</span></div>}
                      </>
                    ) : (
                      <div className="pulse-error">Error: {data.error || 'Connection Failed'}</div>
                    )}
                  </div>
                  <div className="pulse-footer">
                    <div className="pulse-wave"></div>
                  </div>
                </div>
              ))}
            </div>

            <style>{`
              .diagnostics-view { padding: 20px; }
              .pulse-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; margin-top: 30px; }
              .pulse-card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px; position: relative; overflow: hidden; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
              .pulse-card:hover { transform: translateY(-5px); border-color: #555; box-shadow: 0 10px 20px rgba(0,0,0,0.4); }
              .pulse-card.online { border-left: 4px solid #2ecc71; }
              .pulse-card.offline { border-left: 4px solid #e74c3c; opacity: 0.8; }
              .pulse-card.error { border-left: 4px solid #f1c40f; }

              .pulse-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
              .service-name { font-weight: 800; font-size: 0.8rem; color: #888; letter-spacing: 1px; }
              .status-pill { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: bold; }
              .status-pill.online { background: rgba(46, 204, 113, 0.2); color: #2ecc71; }
              .status-pill.offline { background: rgba(231, 76, 60, 0.2); color: #e74c3c; }

              .pulse-body { min-height: 60px; }
              .pulse-metric { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem; }
              .pulse-metric .label { color: #666; }
              .pulse-metric .value { color: #ddd; font-weight: 600; }
              .pulse-metric .latency { color: #2ecc71; }
              .pulse-error { color: #e74c3c; font-size: 0.8rem; line-height: 1.4; }

              .pulse-footer { height: 4px; background: rgba(255,255,255,0.05); margin-top: 15px; border-radius: 2px; }
              .pulse-card.online .pulse-wave { 
                height: 100%; width: 30%; background: #2ecc71; border-radius: 2px;
                animation: pulse-move 2s infinite linear;
              }
              @keyframes pulse-move {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
              }
            `}</style>
          </div>
        )}

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {view === 'stats' && stats && (
          <div className="stats-view">
            <h2>System Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-icon">🎭</div><div className="stat-info"><h3>Total Events</h3><p className="stat-value">{stats.totalEvents}</p></div></div>
              <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-info"><h3>Total Users</h3><p className="stat-value">{stats.totalUsers}</p></div></div>
              <div className="stat-card"><div className="stat-icon">🎟️</div><div className="stat-info"><h3>Tickets Sold</h3><p className="stat-value">{stats.totalTickets}</p></div></div>
              <div className="stat-card"><div className="stat-icon">💰</div><div className="stat-info"><h3>Total Revenue</h3><p className="stat-value">₹{stats.totalRevenue.toFixed(2)}</p></div></div>
              <div className="stat-card" style={{ border: '2px solid #f1c40f' }}>
                <div className="stat-icon">🏢</div>
                <div className="stat-info">
                  <h3>Platform Profit (Wallet)</h3>
                  <p className="stat-value" style={{ color: '#f1c40f' }}>₹{adminWallet.balance.toFixed(2)}</p>
                </div>
              </div>
            </div>
            {stats.recentTickets?.length > 0 && (
              <div className="recent-tickets">
                <h3>Recent Ticket Purchases</h3>
                <div className="tickets-table">
                  <table>
                    <thead><tr><th>Customer</th><th>Event</th><th>Quantity</th><th>Amount</th><th>Date</th></tr></thead>
                    <tbody>
                      {stats.recentTickets.map((t) => (
                        <tr key={t._id}>
                          <td>{t.customerName}</td>
                          <td>{t.event?.name || 'N/A'}</td>
                          <td>{t.quantity}</td>
                          <td>₹{t.totalAmount?.toFixed(2)}</td>
                          <td>{fmtDate(t.purchaseDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Events ────────────────────────────────────────────────────── */}
        {view === 'events' && (
          <div className="events-view">
            <div className="view-header-row">
              <h2 className="view-title">System Event Management</h2>
              <div className="header-actions">
                <div className="search-box-container">
                  <span className="search-icon">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search all events by name or venue..." 
                    className="admin-search-input"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                  />
                  {eventSearch && (
                    <button className="clear-search" onClick={() => setEventSearch('')}>✕</button>
                  )}
                </div>
                <button className="create-event-btn" onClick={() => { setEditingEvent(null); setShowEventForm(true); }}>
                  ➕ Create New Event
                </button>
              </div>
            </div>

            {showEventForm && (
              <AdminEventForm event={editingEvent} onClose={handleEventFormClose} />
            )}

            {!showEventForm && (
              <div className="events-list">
                {events.filter(ev => 
                  ev.name.toLowerCase().includes(eventSearch.toLowerCase()) || 
                  ev.venue.toLowerCase().includes(eventSearch.toLowerCase())
                ).length === 0 ? (
                  <div className="no-data">
                    <p>{eventSearch ? 'No global events match your search.' : 'No events in the system.'}</p>
                  </div>
                ) : (
                  <table className="admin-table events-table high-contrast-table">
                    <thead>
                      <tr>
                        <th>Event Details</th>
                        <th>Date & Time</th>
                        <th>Sold</th>
                        <th>Base Revenue</th>
                        <th>Collected Revenue</th>
                        <th>Profit Margin</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events
                        .filter(ev => 
                          ev.name.toLowerCase().includes(eventSearch.toLowerCase()) || 
                          ev.venue.toLowerCase().includes(eventSearch.toLowerCase())
                        )
                        .map((event) => (
                        <tr key={event._id}>
                          <td className="event-info-cell">
                            <div className="event-name-bold">{event.name}</div>
                            <div className="event-venue-sub">📍 {event.venue}</div>
                          </td>
                          <td className="date-cell">
                            <div className="date-main">{new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            <div className="date-sub">{new Date(event.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="sold-cell">
                            <div className="sold-count">
                              <span className="count-pill">{event.ticketsSold}</span> / {event.capacity}
                            </div>
                            <div className="sold-progress-bg">
                              <div className="sold-progress-fill" style={{ width: `${(event.ticketsSold / event.capacity) * 100}%` }}></div>
                            </div>
                          </td>
                          <td>
                            <div className="amount-dim">₹{event.baseRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </td>
                          <td className="revenue-cell">
                            <div className="amount-bold">₹{event.totalRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </td>
                          <td>
                            <div className={`profit-amount ${(event.profitAmount || 0) > 0 ? 'positive' : 'neutral'}`}>
                              +₹{event.profitAmount?.toFixed(2) || '0.00'}
                            </div>
                            <div className="profit-percent">
                              ({event.profitPercentage?.toFixed(1) || '0.0'}%)
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill ${event.status}`}>{event.status.toUpperCase()}</span>
                          </td>
                           <td>
                            <div className="action-buttons">
                              {event.status !== 'completed' && (
                                <button className="complete-btn" onClick={() => handleCompleteEvent(event._id)} title="Complete Event">✅</button>
                              )}
                              <button className="edit-btn" onClick={() => { setEditingEvent(event); setShowEventForm(true); }} title="Edit">✏️</button>
                              <button className="delete-btn" onClick={() => handleDeleteEvent(event._id)} title="Delete">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tickets ───────────────────────────────────────────────────── */}
        {view === 'tickets' && (
          <div className="tickets-view">
            <div className="view-header">
              <h2>🎟️ Ticket Buyers</h2>
              <button className="refresh-btn" onClick={fetchTickets}>🔄 Refresh</button>
            </div>
            {tickets.length === 0 ? (
              <div className="no-data"><p>No tickets sold yet.</p></div>
            ) : (
              <>
                <div className="tickets-table-container">
                  <table className="admin-table tickets-table">
                    <thead>
                      <tr>
                        <th>Booking Ref</th><th>Buyer Name</th><th>Email</th>
                        <th>Event</th><th>Category</th><th>Qty</th>
                        <th>Total</th><th>Status</th><th>Purchase Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t._id}>
                          <td className="booking-ref">{t.bookingReference}</td>
                          <td>{t.buyerName}</td>
                          <td>{t.buyerEmail}</td>
                          <td>{t.eventName}</td>
                          <td><span className={`category-badge ${t.categoryName}`}>{t.categoryName?.toUpperCase()}</span></td>
                          <td>{t.quantity}</td>
                          <td>₹{t.totalAmount?.toFixed(2)}</td>
                          <td><span className={`status-badge ${t.status}`}>{t.status}</span></td>
                          <td>{fmtDate(t.purchaseDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tickets-summary">
                  <div className="summary-card"><span className="label">Total Tickets</span><span className="value">{tickets.reduce((s, t) => s + t.quantity, 0)}</span></div>
                  <div className="summary-card"><span className="label">Total Revenue</span><span className="value">₹{tickets.reduce((s, t) => s + (t.totalAmount || 0), 0).toFixed(2)}</span></div>
                  <div className="summary-card"><span className="label">Unique Buyers</span><span className="value">{new Set(tickets.map((t) => t.buyerEmail)).size}</span></div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Communication ────────────────────────────────────────────────── */}
        {view === 'communication' && (
          <div className="communication-view">
            <div className="view-header">
              <h2>📢 Communication Center</h2>
              <p className="view-subtitle">Send targeted messages to platform stakeholders</p>
            </div>

            <div className="broadcast-card">
              <form onSubmit={handleBroadcast} className="admin-form">
                <div className="form-group">
                  <label>Target Audience</label>
                    <select 
                      value={messageForm.target} 
                      onChange={(e) => setMessageForm({ ...messageForm, target: e.target.value })}
                    >
                      <option value="all_users">All Registered Users</option>
                      <option value="all_organizers">All Event Organizers</option>
                      <option value="event_attendees">Specific Event Attendees</option>
                      <option value="individual">Specific Individual (DM)</option>
                    </select>
                  </div>

                  {messageForm.target === 'individual' && (
                    <div className="form-group">
                      <label>Target User ID</label>
                      <input 
                        type="text" 
                        placeholder="Paste User ID here..." 
                        value={messageForm.targetId}
                        onChange={(e) => setMessageForm({ ...messageForm, targetId: e.target.value })}
                      />
                    </div>
                  )}

                  {messageForm.target === 'event_attendees' && (
                    <div className="form-group">
                      <label>Select Event</label>
                      <select 
                        value={messageForm.targetId} 
                        onChange={(e) => setMessageForm({ ...messageForm, targetId: e.target.value })}
                      >
                        <option value="">-- Select an Event --</option>
                        {events.map(ev => (
                          <option key={ev._id} value={ev._id}>{ev.name} ({ev.ticketsSold} attendees)</option>
                        ))}
                      </select>
                    </div>
                  )}

                <div className="form-group">
                  <label>Message Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Update on System Maintenance" 
                    value={messageForm.title}
                    onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Message Content</label>
                  <textarea 
                    rows="5" 
                    placeholder="Type your announcement or direct message here..."
                    value={messageForm.message}
                    onChange={(e) => setMessageForm({ ...messageForm, message: e.target.value })}
                  />
                </div>

                <button type="submit" className="broadcast-btn" disabled={loading}>
                  {loading ? '🚀 Sending...' : '📢 Dispatch Now'}
                </button>
              </form>
            </div>
            
            <style>{`
              .communication-view { max-width: 800px; margin: 0 auto; padding: 20px; }
              .broadcast-card { background: #1a1a1a; border: 1px solid #333; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
              .admin-form .form-group { margin-bottom: 20px; }
              .admin-form label { display: block; margin-bottom: 8px; font-weight: 600; color: #aaa; }
              .admin-form input, .admin-form select, .admin-form textarea {
                width: 100%; padding: 12px; border-radius: 6px; border: 1px solid #444; background: #222; color: #fff; font-size: 1rem;
              }
              .broadcast-btn { 
                width: 100%; background: #f1c40f; color: #000; border: none; padding: 15px; border-radius: 6px; 
                font-weight: bold; cursor: pointer; font-size: 1.1rem; transition: all 0.2s;
              }
              .broadcast-btn:hover:not(:disabled) { background: #d4ac0d; transform: translateY(-2px); }
              .broadcast-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
          </div>
        )}

        {/* ── Users ─────────────────────────────────────────────────────── */}
        {view === 'users' && (
          <div className="users-view">
            <div className="view-header">
              <div className="title-group">
                <h2>👥 Registered Users</h2>
                <span className="count-pill">{users.length} total</span>
              </div>
              <div className="user-controls">
                <div className="search-bar">
                  <span className="search-icon">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search by name or email..." 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
                <select 
                  className="role-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="organizer">Organizers</option>
                  <option value="user">Members</option>
                </select>
                <button className="refresh-btn" onClick={fetchUsers}>🔄 Refresh</button>
              </div>
            </div>

            {filteredUsers.length === 0 && !loading ? (
              <div className="no-data">
                <div className="no-data-icon">🔍</div>
                <p>{userSearch || roleFilter !== 'all' ? 'No users match your criteria' : 'No users found.'}</p>
                {(userSearch || roleFilter !== 'all') && (
                  <button className="clear-filter-btn" onClick={() => { setUserSearch(''); setRoleFilter('all'); }}>
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="tickets-table-container user-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User Identity</th><th>Role</th>
                        <th>Subscription</th><th>Location</th><th>Joined</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u._id}>
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar" style={{ backgroundColor: getAvatarColor(u.name) }}>
                                {getInitials(u.name)}
                              </div>
                              <div className="user-name-group">
                                <span className="user-name">{u.name}</span>
                                <span className="user-email-sub">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <select 
                              className={`role-inline-select ${u.role}`}
                              value={u.role}
                              onChange={(e) => handleRoleUpdate(u._id, e.target.value)}
                              style={{ 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                border: '1px solid #ccc', 
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                textTransform: 'uppercase'
                              }}
                            >
                              <option value="user">USER</option>
                              <option value="organizer">ORGANIZER</option>
                              <option value="admin">ADMIN</option>
                            </select>
                          </td>
                          <td>
                            {u.subscription?.plan && u.subscription.plan !== 'none'
                              ? <div className="sub-badge active">
                                  <span className="sub-icon">⭐</span>
                                  {u.subscription.plan.replace(/_/g, ' ').toUpperCase()}
                                </div>
                              : <span className="sub-badge free">Free Member</span>}
                          </td>
                          <td className="city-cell">{u.city || '—'}</td>
                          <td className="date-cell">{fmtDate(u.createdAt)}</td>
                          <td>
                            <div className="action-buttons">
                              <button className="msg-btn" onClick={() => handleDirectMessage(u._id)} title="Direct Message" style={{ background: '#3498db', border: 'none', borderRadius: '4px', padding: '5px', cursor: 'pointer', marginRight: '5px' }}>💬</button>
                              <button className="manage-btn" title="Manage User">⚙️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="tickets-summary">
                  <div className="summary-card">
                    <span className="label">Total System Users</span>
                    <span className="value">{users.length}</span>
                  </div>
                  <div className="summary-card">
                    <span className="label">Active Subscribers</span>
                    <span className="value highlighting">{users.filter(u => u.subscription?.isActive).length}</span>
                  </div>
                  <div className="summary-card">
                    <span className="label">Growth Ratio</span>
                    <span className="value">
                      {users.length > 0 ? ((users.filter(u => u.subscription?.isActive).length / users.length) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Organizers & Commissions ─────────────────────────────────────── */}
        {view === 'organizers' && (
          <div className="commissions-view">
            <div className="view-header">
              <div className="title-group">
                <h2>🏢 Organizer Commissions (20% Cut)</h2>
                <span className="count-pill">{commissions.length} payouts</span>
              </div>
              <button className="refresh-btn" onClick={fetchCommissions}>🔄 Refresh</button>
            </div>

            {commissions.length === 0 ? (
              <div className="no-data"><p>No commissions collected yet.</p></div>
            ) : (
              <div className="tickets-table-container">
                <table className="admin-table high-contrast-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Organizer</th>
                      <th>Total Revenue</th>
                      <th>Admin Cut (20%)</th>
                      <th>Date Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c._id}>
                        <td>{c.eventId?.name || 'Unknown Event'}</td>
                        <td>
                          <div className="user-name-group">
                            <span className="user-name">{c.organizerId?.name}</span>
                            <span className="user-email-sub">{c.organizerId?.email}</span>
                          </div>
                        </td>
                        <td className="amount-dim">₹{c.totalRevenue?.toLocaleString()}</td>
                        <td className="revenue-cell">
                          <div className="amount-bold">₹{c.commissionAmount?.toLocaleString()}</div>
                        </td>
                        <td className="date-cell">{fmtDate(c.payoutDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="tickets-summary">
              <div className="summary-card">
                <span className="label">Total Earnings</span>
                <span className="value highlighting">₹{commissions.reduce((s, c) => s + c.commissionAmount, 0).toLocaleString()}</span>
              </div>
              <div className="summary-card">
                <span className="label">Managed Revenue</span>
                <span className="value">₹{commissions.reduce((s, c) => s + c.totalRevenue, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function AdminDashboardWrapper(props) {
  return (
    <div className="admin-page-container" style={{ paddingBottom: '100px' }}>
      <AdminDashboard {...props} />
    </div>
  );
}
