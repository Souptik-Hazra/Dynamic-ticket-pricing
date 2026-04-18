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
  const [loading, setLoading]             = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent]   = useState(null);
  const [userSearch, setUserSearch]       = useState(''); 
  const [eventSearch, setEventSearch]     = useState(''); 
  const [roleFilter, setRoleFilter]         = useState('all');

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
  }, [view]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(buildUrl('/admin/stats'), authHeaders());
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
      const { data } = await axios.get(buildUrl('/admin/tickets'), authHeaders());
      setTickets(data.tickets);
    } catch (err) {
      console.error('Tickets error:', err);
      alert('Failed to fetch tickets');
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

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await axios.delete(buildUrl(`/admin/events/${eventId}`), authHeaders());
      fetchEvents();
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
        </div>
      </header>

      <nav className="admin-nav">
        <button className={view === 'stats'   ? 'active' : ''} onClick={() => setView('stats')}>📊 Statistics</button>
        <button className={view === 'events'  ? 'active' : ''} onClick={() => setView('events')}>🎭 Manage Events</button>
        <button className={view === 'tickets' ? 'active' : ''} onClick={() => setView('tickets')}>🎟️ Ticket Buyers</button>
        <button className={view === 'users'   ? 'active' : ''} onClick={() => setView('users')}>👥 Users</button>
      </nav>

      <main className="admin-content">
        {loading && <div className="loading">Loading...</div>}

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {view === 'stats' && stats && (
          <div className="stats-view">
            <h2>System Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-icon">🎭</div><div className="stat-info"><h3>Total Events</h3><p className="stat-value">{stats.totalEvents}</p></div></div>
              <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-info"><h3>Total Users</h3><p className="stat-value">{stats.totalUsers}</p></div></div>
              <div className="stat-card"><div className="stat-icon">🎟️</div><div className="stat-info"><h3>Tickets Sold</h3><p className="stat-value">{stats.totalTickets}</p></div></div>
              <div className="stat-card"><div className="stat-icon">💰</div><div className="stat-info"><h3>Total Revenue</h3><p className="stat-value">₹{stats.totalRevenue.toFixed(2)}</p></div></div>
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
                          <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
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
                            <button className="manage-btn" title="Manage User">⚙️</button>
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
