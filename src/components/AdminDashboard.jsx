import React, { useState, useEffect } from 'react';
import api from '../api/client';
import AdminEventForm from './AdminEventForm';
import EventMapModal from './EventMapModal';
import { ENDPOINTS } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';

function AdminDashboard() {
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
    if (lastEvent.type === 'ticket_sold') {
      if (view === 'stats') fetchStats();
      fetchAdminWallet();
    }
    if (lastEvent.type === 'notification') {
      fetchAdminWallet();
    }
  }, [lastEvent]); // eslint-disable-line

  useEffect(() => {
    if (view === 'stats')   fetchStats();
    if (view === 'events')  fetchEvents();
    if (view === 'tickets') fetchTickets();
    if (view === 'users')   fetchUsers();
    if (view === 'organizers') fetchCommissions();
    if (view === 'diagnostics') fetchPlatformHealth();
    fetchAdminWallet();
  }, [view]);

  async function fetchPlatformHealth() {
    try {
      setHealthData(prev => ({ ...prev, loading: true }));
      const { data } = await api.get(ENDPOINTS.PLATFORM_HEALTH);
      setHealthData({ services: data.services || {}, loading: false });
    } catch (err) {
      console.error('Health check error:', err);
      setHealthData(prev => ({ ...prev, loading: false }));
    }
  }

  async function fetchAdminWallet() {
    try {
      const { data } = await api.get(ENDPOINTS.WALLET_BALANCE);
      setAdminWallet(data);
    } catch (err) { console.error('Admin wallet error:', err); }
  }

  async function fetchStats() {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ADMIN_STATS);
      setStats(data.stats);
    } catch (err) {
      console.error('Stats error:', err);
      alert('Failed to fetch statistics');
    } finally { setLoading(false); }
  }

  async function fetchEvents() {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ADMIN_EVENTS);
      setEvents(data.events);
    } catch (err) {
      console.error('Events error:', err);
      alert('Failed to fetch events');
    } finally { setLoading(false); }
  }

  async function fetchTickets() {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ADMIN_TICKETS);
      setTickets(data.tickets);
    } catch (err) {
      console.error('Tickets error:', err);
      alert('Failed to fetch tickets');
    } finally { setLoading(false); }
  }


  async function fetchCommissions() {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ADMIN_COMMISSIONS);
      setCommissions(data.commissions || []);
    } catch (err) {
      console.error('Commissions error:', err);
    } finally { setLoading(false); }
  }

  const handleCompleteEvent = async (eventId) => {
    if (!window.confirm('Mark this event as COMPLETED and process 20% commission? This action is irreversible.')) return;
    try {
      setLoading(true);
      await api.post(`${ENDPOINTS.ADMIN_EVENTS}/${eventId}/complete`, {});
      alert('Event completed and commission transferred!');
      fetchEvents();
      fetchAdminWallet();
    } catch (err) {
      console.error('Completion error:', err);
      alert(err.response?.data?.error || 'Failed to complete event');
    } finally { setLoading(false); }
  };

  async function fetchUsers() {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ADMIN_USERS);
      setUsers(data.users || []);
    } catch (err) {
      console.error('Users error:', err);
      alert('Failed to fetch users');
    } finally { setLoading(false); }
  }

  const handleRoleUpdate = async (userId, newRole) => {
    if (!window.confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) return;
    try {
      setLoading(true);
      await api.put(`${ENDPOINTS.ADMIN_USERS}/${userId}/role`, { role: newRole });
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
      await api.post(ENDPOINTS.ADMIN_BROADCAST, messageForm);
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
      await api.delete(`${ENDPOINTS.ADMIN_EVENTS}/${eventId}`);
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

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapEvent, setMapEvent] = useState(null);

  const openMapForEvent = (event) => { setMapEvent(event); setShowMapModal(true); };

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
    <div className="cyber-container animate-fade-up" style={{ padding: '1.5rem 0' }}>
      <header className="flex-between" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 className="title-main text-gradient" style={{ margin: 0 }}>🎫 Admin Dashboard</h1>
          <p className="text-muted">Platform Control Center</p>
        </div>
        <div className="flex-center" style={{ gap: '1.5rem' }}>
          <span className={`cyber-badge ${connected ? 'badge-success' : 'badge-danger'}`}
                title={connected ? 'Live updates connected' : 'Offline'}>
            {connected ? '● Live WebSocket' : '● Offline'}
          </span>
          <div className="glass-panel" style={{ padding: '0.6rem 1.25rem', borderRadius: '12px' }}>
            <span className="cyber-label" style={{ fontSize: '0.7rem', display: 'block' }}>Platform Balance</span>
            <span className="text-glow" style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--success)' }}>
              ₹{adminWallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </header>

      <div className="cyber-grid" style={{ gridTemplateColumns: '220px 1fr', gap: '2rem' }}>
        {/* Navigation Sidebar */}
        <nav className="cyber-sidebar">
          {[
            { id: 'stats', label: '📊 Global Metrics' },
            { id: 'events', label: '📅 Event Hub' },
            { id: 'tickets', label: '🎟️ Ticket Ledger' },
            { id: 'users', label: '👥 Citizen Registry' },
            { id: 'organizers', label: '🤝 Partner Logs' },
            { id: 'communication', label: '📢 Neural Broadcast' },
            { id: 'diagnostics', label: '🩺 System Pulse' },
            { id: 'security', label: '🛡️ Market Security' }
          ].map(nav => (
            <button 
              key={nav.id}
              className={`cyber-btn ${view === nav.id ? 'active' : ''}`}
              onClick={() => setView(nav.id)}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        {/* Main Content Area */}
        <main>
          {loading && (
            <div className="flex-center" style={{ padding: '3rem' }}>
              <div className="text-glow animate-pulse">Synchronizing with core microservices...</div>
            </div>
          )}

          {/* ── System Pulse / Health ─────────────────────────────────── */}
          {view === 'diagnostics' && (
            <div className="animate-fade-up">
              <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <h2 className="title-sub" style={{ margin: 0 }}>🩺 Technical Health Monitor</h2>
                <button className="cyber-btn btn-outline" onClick={fetchPlatformHealth} disabled={healthData.loading}>
                  {healthData.loading ? '🔄 Refreshing...' : '🔄 System Check'}
                </button>
              </div>

              <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {Object.entries(healthData.services).map(([name, data]) => {
                  const isHealthy = ['online', 'ok', 'healthy'].includes(data.status.toLowerCase());
                  return (
                    <div key={name} className="cyber-card" style={{ borderLeft: `4px solid ${isHealthy ? 'var(--success)' : 'var(--danger)'}`, padding: '1rem' }}>
                      <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
                        <span className="cyber-label" style={{ fontSize: '0.75rem' }}>{name.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                        <span className={`cyber-badge ${isHealthy ? 'badge-success' : 'badge-danger'}`}>{data.status.toUpperCase()}</span>
                      </div>
                      <div className="flex-column" style={{ gap: '0.8rem' }}>
                        {isHealthy ? (
                          <>
                            <div className="flex-between">
                              <span className="text-dim" style={{ fontSize: '0.85rem' }}>Latency:</span>
                              <span style={{ color: 'var(--success)', fontWeight: '700' }}>{data.latency}</span>
                            </div>
                            <div className="flex-between">
                              <span className="text-dim" style={{ fontSize: '0.85rem' }}>Stability:</span>
                              <span className="text-main">99.9%</span>
                            </div>
                          </>
                        ) : (
                          <p className="badge-danger" style={{ padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                            {data.error || 'Connection Failed'}
                          </p>
                        )}
                      </div>
                      <div style={{ marginTop: '1.5rem', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                         {isHealthy && <div className="pulse-fill" style={{ width: '100%', height: '100%', background: 'var(--success)', opacity: 0.3 }}></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Stats ─────────────────────────────────────────────────────── */}
          {view === 'stats' && stats && (
            <div className="animate-fade-up">
              <h2 className="title-sub">System-Wide Intelligence</h2>
              <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--accent-cyan)' }}>
                  <span className="cyber-label" style={{ fontSize: '0.65rem' }}>Total Events</span>
                  <p className="text-glow" style={{ fontSize: '1.5rem', fontWeight: '900' }}>{stats.totalEvents}</p>
                </div>
                <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--accent-purple)' }}>
                  <span className="cyber-label" style={{ fontSize: '0.65rem' }}>Global Users</span>
                  <p className="text-glow" style={{ fontSize: '1.5rem', fontWeight: '900' }}>{stats.totalUsers}</p>
                </div>
                <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--accent-pink)' }}>
                  <span className="cyber-label" style={{ fontSize: '0.65rem' }}>Total Tickets Sold</span>
                  <p className="text-glow" style={{ fontSize: '1.5rem', fontWeight: '900' }}>{stats.totalTickets}</p>
                </div>
                <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--success)' }}>
                  <span className="cyber-label">Gross Revenue</span>
                  <p className="text-glow" style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--success)' }}>₹{stats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--accent-cyan)' }}>
                  <span className="cyber-label">Platform Profit</span>
                  <p className="text-gradient" style={{ fontSize: '1.4rem', fontWeight: '900' }}>₹{stats.totalProfit?.toLocaleString()}</p>
                </div>
              </div>

              {stats.recentTickets?.length > 0 && (
                <div style={{ marginTop: '3rem' }}>
                  <h3 className="cyber-label" style={{ marginBottom: '1rem' }}>Live Stream: Recent Purchases</h3>
                  <div className="cyber-table-container">
                    <table className="cyber-table">
                      <thead><tr><th>Customer</th><th>Event</th><th>Qty</th><th>Amount</th><th>Timestamp</th></tr></thead>
                      <tbody>
                        {stats.recentTickets.map((t) => (
                          <tr key={t._id}>
                            <td><span className="text-main" style={{ fontWeight: '700' }}>{t.customerName}</span></td>
                            <td><span className="text-dim">{t.event?.name || 'N/A'}</span></td>
                            <td>{t.quantity}</td>
                            <td><span style={{ color: 'var(--success)' }}>₹{t.totalAmount?.toFixed(2)}</span></td>
                            <td><span className="text-dim" style={{ fontSize: '0.8rem' }}>{fmtDate(t.purchaseDate)}</span></td>
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
            <div className="animate-fade-up">
              <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <h2 className="title-sub" style={{ margin: 0 }}>System Event Management</h2>
                <div className="flex-center" style={{ gap: '1rem' }}>
                  <div className="glass-panel" style={{ padding: '0.2rem 1rem', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '0.5rem' }}>🔍</span>
                    <input 
                      type="text" 
                      placeholder="Filter global events..." 
                      className="cyber-input"
                      style={{ border: 'none', background: 'transparent' }}
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                    />
                  </div>
                  <button className="cyber-btn btn-primary" onClick={() => { setEditingEvent(null); setShowEventForm(true); }}>
                    ➕ New Event
                  </button>
                </div>
              </div>

              {showEventForm && (
                <div className="cyber-card animate-fade-up">
                   <AdminEventForm event={editingEvent} onClose={handleEventFormClose} />
                </div>
              )}

              {!showEventForm && (
                <div className="cyber-table-container">
                  <table className="cyber-table">
                    <thead>
                      <tr>
                        <th>Event Details</th>
                        <th>Schedule</th>
                        <th>Sold / Cap</th>
                        <th>Revenue Flow</th>
                        <th>Profit</th>
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
                          <td>
                            <div className="text-main" style={{ fontWeight: '800' }}>{event.name}</div>
                            <div className="text-dim" style={{ fontSize: '0.8rem' }}>📍 {event.venue}</div>
                          </td>
                          <td>
                            <div className="flex-column" style={{ gap: '0.2rem' }}>
                              <div className="text-main" style={{ fontSize: '0.85rem' }}>
                                <span className="cyber-label" style={{ fontSize: '0.6rem', marginRight: '4px' }}>START</span>
                                {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              {event.endDate && (
                                <div className="text-dim" style={{ fontSize: '0.75rem' }}>
                                  <span className="cyber-label" style={{ fontSize: '0.6rem', marginRight: '4px' }}>END</span>
                                  {new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="flex-column">
                              <span style={{ fontWeight: '800' }}>{event.ticketsSold} <span className="text-dim" style={{ fontWeight: '400' }}>/ {event.capacity}</span></span>
                              <div style={{ width: '60px', height: '4px', background: 'var(--bg-deep)', borderRadius: '2px', marginTop: '4px' }}>
                                <div style={{ width: `${(event.ticketsSold / event.capacity) * 100}%`, height: '100%', background: 'var(--accent-indigo)' }}></div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="text-dim" style={{ fontSize: '0.75rem' }}>Base: ₹{event.baseRevenue?.toLocaleString()}</div>
                            <div className="text-main" style={{ fontWeight: '800', color: 'var(--success)' }}>₹{event.totalRevenue?.toLocaleString()}</div>
                          </td>
                          <td>
                             <div style={{ color: 'var(--accent-cyan)', fontWeight: '800' }}>+₹{event.profitAmount?.toFixed(0)}</div>
                             <div className="text-dim" style={{ fontSize: '0.75rem' }}>({event.profitPercentage?.toFixed(1)}%)</div>
                          </td>
                          <td>
                            <span className={`cyber-badge badge-${event.status}`}>{event.status}</span>
                          </td>
                           <td>
                            <div className="flex-center" style={{ gap: '0.5rem' }}>
                              {event.status !== 'completed' && (
                                <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => handleCompleteEvent(event._id)} title="Complete">✅</button>
                              )}
                              <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => openMapForEvent(event)}>🗺️</button>
                              <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => { setEditingEvent(event); setShowEventForm(true); }}>✏️</button>
                              <button className="cyber-btn btn-danger" style={{ padding: '0.4rem' }} onClick={() => handleDeleteEvent(event._id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {showMapModal && <EventMapModal event={mapEvent} onClose={() => setShowMapModal(false)} />}

          {/* ── Users ─────────────────────────────────────────────────────── */}
          {view === 'users' && (
            <div className="animate-fade-up">
              <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <div className="flex-center" style={{ gap: '1rem' }}>
                  <h2 className="title-sub" style={{ margin: 0 }}>Registered Citizens</h2>
                  <span className="cyber-badge badge-info">{users.length} TOTAL</span>
                </div>
                <div className="flex-center" style={{ gap: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder="Search by name/email..." 
                    className="cyber-input"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  <select 
                    className="cyber-input"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admins</option>
                    <option value="organizer">Organizers</option>
                    <option value="user">Members</option>
                  </select>
                </div>
              </div>

              <div className="cyber-table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Identity</th>
                      <th>Level / Role</th>
                      <th>Subscription</th>
                      <th>Last Seen</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u._id}>
                        <td>
                          <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '1rem' }}>
                            <div style={{ 
                              width: '40px', height: '40px', borderRadius: '50%', 
                              background: getAvatarColor(u.name), 
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: '900', fontSize: '0.8rem', color: 'white'
                            }}>
                              {getInitials(u.name)}
                            </div>
                            <div className="flex-column">
                              <span className="text-main" style={{ fontWeight: '700' }}>{u.name}</span>
                              <span className="text-dim" style={{ fontSize: '0.75rem' }}>{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <select 
                            className="cyber-input"
                            value={u.role}
                            onChange={(e) => handleRoleUpdate(u._id, e.target.value)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: '800' }}
                          >
                            <option value="user">USER</option>
                            <option value="organizer">ORGANIZER</option>
                            <option value="admin">ADMIN</option>
                          </select>
                        </td>
                        <td>
                          {u.subscription?.plan && u.subscription.plan !== 'none'
                            ? <span className="cyber-badge badge-info">⭐ {u.subscription.plan.toUpperCase()}</span>
                            : <span className="text-dim" style={{ fontSize: '0.8rem' }}>Free Member</span>}
                        </td>
                        <td><span className="text-dim" style={{ fontSize: '0.8rem' }}>{fmtDate(u.createdAt)}</span></td>
                        <td>
                          <div className="flex-center" style={{ gap: '0.5rem' }}>
                            <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => handleDirectMessage(u._id)}>💬</button>
                            <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }}>⚙️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Communication ────────────────────────────────────────────────── */}
          {view === 'communication' && (
            <div className="animate-fade-up" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="flex-column" style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h2 className="title-sub">📢 Neural Broadcast Hub</h2>
                <p className="text-dim">Dispatch platform-wide announcements or targeted neural links.</p>
              </div>

              <div className="cyber-card">
                <form onSubmit={handleBroadcast} className="flex-column" style={{ gap: '1.5rem' }}>
                  <div className="cyber-form-group">
                    <label className="cyber-label">Target Audience</label>
                    <select 
                      className="cyber-input"
                      value={messageForm.target} 
                      onChange={(e) => setMessageForm({ ...messageForm, target: e.target.value })}
                    >
                      <option value="all_users">All Registered Citizens</option>
                      <option value="all_organizers">All Event Organizers</option>
                      <option value="event_attendees">Specific Event Stakeholders</option>
                      <option value="individual">Individual Neural ID</option>
                    </select>
                  </div>

                  {messageForm.target === 'individual' && (
                    <div className="cyber-form-group">
                      <label className="cyber-label">Neural ID (User ID)</label>
                      <input 
                        className="cyber-input"
                        type="text" 
                        placeholder="Paste User ID here..." 
                        value={messageForm.targetId}
                        onChange={(e) => setMessageForm({ ...messageForm, targetId: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="cyber-form-group">
                    <label className="cyber-label">Broadcast Subject</label>
                    <input 
                      className="cyber-input"
                      type="text" 
                      placeholder="e.g., Protocol Update" 
                      value={messageForm.title}
                      onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
                    />
                  </div>

                  <div className="cyber-form-group">
                    <label className="cyber-label">Neural Data (Message)</label>
                    <textarea 
                      className="cyber-input"
                      rows="6" 
                      placeholder="Type your message here..."
                      value={messageForm.message}
                      onChange={(e) => setMessageForm({ ...messageForm, message: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="cyber-btn btn-primary" style={{ width: '100%', padding: '1.2rem' }} disabled={loading}>
                    {loading ? '🚀 Dispatching...' : '📢 DISPATCH BROADCAST'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── Market Security (DECPG) ────────────────────────────────────── */}
          {view === 'security' && (
            <div className="animate-fade-up">
              <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <h2 className="title-sub" style={{ margin: 0 }}>🛡️ Decentralized Market Governance (DECPG)</h2>
                <span className="cyber-badge badge-info">AI-DRIVEN PROTECTION ACTIVE</span>
              </div>

              <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* AI Cognitive Pulse */}
                <div className="cyber-card">
                  <h3 className="cyber-label" style={{ marginBottom: '1.5rem' }}>🧠 Edge-AI Cognitive Pulse</h3>
                  <div className="flex-column" style={{ gap: '1.5rem' }}>
                    <div className="flex-between">
                      <span className="text-dim">Global Human Confidence:</span>
                      <span className="text-glow" style={{ color: 'var(--success)', fontWeight: '800' }}>94.2%</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-dim">Avg. Inference Latency:</span>
                      <span className="text-main">12ms</span>
                    </div>
                    <div className="flex-between">
                      <span className="text-dim">Active Federated Nodes:</span>
                      <span className="text-main">1,240</span>
                    </div>
                    <div style={{ height: '40px', background: 'var(--bg-deep)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div className="pulse-fill" style={{ width: '94%', height: '100%', background: 'var(--success)', opacity: 0.2 }}></div>
                      <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.05)' }}></div>
                    </div>
                  </div>
                </div>

                {/* Threat Matrix */}
                <div className="cyber-card">
                  <h3 className="cyber-label" style={{ marginBottom: '1.5rem' }}>🚨 Real-time Threat Matrix</h3>
                  <div className="flex-column" style={{ gap: '1rem' }}>
                    <div className="flex-between glass-panel" style={{ padding: '0.8rem', borderLeft: '3px solid var(--danger)' }}>
                      <span className="text-main">L4 Bot Flood Thwarted</span>
                      <span className="cyber-badge badge-danger">BLOCK</span>
                    </div>
                    <div className="flex-between glass-panel" style={{ padding: '0.8rem', borderLeft: '3px solid var(--warning)' }}>
                      <span className="text-main">Anomalous Pricing Gradient</span>
                      <span className="cyber-badge badge-warning">AUDITED</span>
                    </div>
                    <div className="flex-between glass-panel" style={{ padding: '0.8rem', borderLeft: '3px solid var(--info)' }}>
                      <span className="text-main">Zero-Entropy Browser Signature</span>
                      <span className="cyber-badge badge-info">VDF DELAY</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Audit Ledger */}
              <div style={{ marginTop: '3rem' }}>
                <h3 className="cyber-label" style={{ marginBottom: '1rem' }}>📜 Pricing Audit Ledger (Blockchain Sync)</h3>
                <div className="cyber-table-container">
                  <table className="cyber-table">
                    <thead>
                      <tr>
                        <th>Decision Hash</th>
                        <th>Event</th>
                        <th>Decision Type</th>
                        <th>Status</th>
                        <th>Integrity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { hash: '0x8f2a...3e9d', event: 'Summer Fest 2026', type: 'Occupancy Spike', status: 'COMMITTED' },
                        { hash: '0x1c4b...7f2a', event: 'Global Tech Con', type: 'Velocity Adjustment', status: 'VERIFIED' },
                        { hash: '0x9a3d...1b4c', event: 'Neon Nights', type: 'Base Recalibration', status: 'COMMITTED' }
                      ].map((log, i) => (
                        <tr key={i}>
                          <td><code className="text-glow" style={{ color: 'var(--accent-cyan)' }}>{log.hash}</code></td>
                          <td>{log.event}</td>
                          <td><span className="text-dim">{log.type}</span></td>
                          <td><span className="cyber-badge badge-success">{log.status}</span></td>
                          <td><span style={{ color: 'var(--success)' }}>100%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Ticket Ledger ─────────────────────────────────────────────────── */}
          {view === 'tickets' && (
            <div className="animate-fade-up">
              <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <h2 className="title-sub" style={{ margin: 0 }}>🎟️ Global Ticket Ledger</h2>
                <button className="cyber-btn btn-outline" onClick={fetchTickets}>🔄 Sync Data</button>
              </div>
              <div className="cyber-table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Patron</th>
                      <th>Production</th>
                      <th>Qty</th>
                      <th>Magnitude</th>
                      <th>State</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t._id}>
                        <td><code>{t.bookingReference}</code></td>
                        <td>
                          <div className="flex-column">
                            <span className="text-main" style={{ fontWeight: '700' }}>{t.buyerName}</span>
                            <span className="text-dim" style={{ fontSize: '0.7rem' }}>{t.buyerEmail}</span>
                          </div>
                        </td>
                        <td>
                          <div className="text-main">{t.eventName}</div>
                          <div className="text-dim" style={{ fontSize: '0.7rem' }}>{t.categoryName}</div>
                        </td>
                        <td>×{t.quantity}</td>
                        <td className="text-glow" style={{ color: 'var(--success)' }}>₹{t.totalAmount?.toLocaleString()}</td>
                        <td><span className={`cyber-badge badge-${t.status}`}>{t.status.toUpperCase()}</span></td>
                        <td><span className="text-dim" style={{ fontSize: '0.8rem' }}>{fmtDate(t.purchaseDate)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Partner Logs / Commissions ────────────────────────────────────── */}
          {view === 'organizers' && (
            <div className="animate-fade-up">
              <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <h2 className="title-sub" style={{ margin: 0 }}>🤝 Partner Revenue Logs</h2>
                <button className="cyber-btn btn-outline" onClick={fetchCommissions}>🔄 Refresh Ledger</button>
              </div>
              <div className="cyber-table-container">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Production</th>
                      <th>Gross Revenue</th>
                      <th>Commission (20%)</th>
                      <th>State</th>
                      <th>Payout Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c._id}>
                        <td>
                          <div className="flex-column">
                            <span className="text-main" style={{ fontWeight: '700' }}>{c.organizerId?.name}</span>
                            <span className="text-dim" style={{ fontSize: '0.7rem' }}>{c.organizerId?.email}</span>
                          </div>
                        </td>
                        <td>
                          <div className="text-main">{c.eventId?.name}</div>
                          <div className="text-dim" style={{ fontSize: '0.7rem' }}>{c.eventId?.venue}</div>
                        </td>
                        <td>₹{c.totalRevenue?.toLocaleString()}</td>
                        <td className="text-glow" style={{ color: 'var(--accent-cyan)' }}>₹{c.commissionAmount?.toLocaleString()}</td>
                        <td><span className={`cyber-badge badge-${c.status}`}>{c.status.toUpperCase()}</span></td>
                        <td><span className="text-dim" style={{ fontSize: '0.8rem' }}>{fmtDate(c.payoutDate)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fallback or default */}
          {!view && (
            <div className="flex-center" style={{ padding: '5rem', border: '1px dashed var(--border-dim)', borderRadius: '20px' }}>
              <p className="text-dim">Terminal Ready. Select a module from the sidebar.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
