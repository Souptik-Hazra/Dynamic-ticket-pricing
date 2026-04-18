import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AdminEventForm from './AdminEventForm';
import Footer from './Footer';
import { buildUrl, ENDPOINTS } from '../config/api';
import './AdminDashboard.css';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [view, setView]   = useState('stats');
  const [stats, setStats] = useState(null);
  const [events, setEvents]               = useState([]);
  const [tickets, setTickets]             = useState([]);
  const [fraudAnalytics, setFraudAnalytics] = useState(null);
  const [loading, setLoading]             = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent]   = useState(null);

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  useEffect(() => {
    if (view === 'stats')  fetchStats();
    if (view === 'events') fetchEvents();
    if (view === 'tickets') fetchTickets();
    if (view === 'fraud')  fetchFraudAnalytics();
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

  const fetchFraudAnalytics = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(buildUrl('/admin/fraud-analytics'), authHeaders());
      setFraudAnalytics(data.fraudAnalytics);
    } catch (err) {
      console.error('Fraud error:', err);
      alert('Failed to fetch fraud analytics');
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

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>🎫 Admin Dashboard</h1>
        </div>
      </header>

      <nav className="admin-nav">
        <button className={view === 'stats'   ? 'active' : ''} onClick={() => setView('stats')}>📊 Statistics</button>
        <button className={view === 'events'  ? 'active' : ''} onClick={() => setView('events')}>🎭 Manage Events</button>
        <button className={view === 'tickets' ? 'active' : ''} onClick={() => setView('tickets')}>🎟️ Ticket Buyers</button>
        <button className={view === 'fraud'   ? 'active' : ''} onClick={() => setView('fraud')}>🚨 Fraud Analytics</button>
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
            <div className="events-header">
              <h2>Event Management</h2>
              <button className="create-event-btn" onClick={() => { setEditingEvent(null); setShowEventForm(true); }}>
                ➕ Create New Event
              </button>
            </div>
            {showEventForm && (
              <AdminEventForm event={editingEvent} onClose={handleEventFormClose} />
            )}
            {!showEventForm && (
              <div className="events-list">
                {events.length === 0 ? (
                  <p className="no-events">No events found. Create one to get started!</p>
                ) : (
                  <table className="events-table">
                    <thead>
                      <tr>
                        <th>Event Name</th><th>Venue</th><th>Date</th>
                        <th>Capacity</th><th>Sold</th><th>Base Revenue</th>
                        <th>Actual Revenue</th><th>Profit Margin</th><th>Status</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event._id}>
                          <td><strong>{event.name}</strong></td>
                          <td>{event.venue}</td>
                          <td>
                            {event.startDate
                              ? (() => {
                                  const fmt = { month: 'short', day: 'numeric', year: 'numeric' };
                                  const s = new Date(event.startDate).toLocaleDateString('en-US', fmt);
                                  const e = event.endDate ? new Date(event.endDate).toLocaleDateString('en-US', fmt) : null;
                                  return e && e !== s ? `${s} – ${e}` : s;
                                })()
                              : 'N/A'}
                          </td>
                          <td>{event.capacity}</td>
                          <td>{event.ticketsSold}</td>
                          <td>₹{event.baseRevenue?.toFixed(2) || '0.00'}</td>
                          <td>₹{event.totalRevenue?.toFixed(2) || '0.00'}</td>
                          <td>
                            <span className={`profit-badge ${(event.profitAmount || 0) > 0 ? 'positive' : (event.profitAmount || 0) < 0 ? 'negative' : 'neutral'}`}>
                              {(event.profitAmount || 0) > 0 ? '+' : ''}₹{event.profitAmount?.toFixed(2) || '0.00'}
                              <small> ({event.profitPercentage?.toFixed(1) || 0}%)</small>
                            </span>
                          </td>
                          <td><span className={`status-badge ${event.status}`}>{event.status}</span></td>
                          <td>
                            <div className="action-buttons">
                              <button className="edit-btn" onClick={() => { setEditingEvent(event); setShowEventForm(true); }}>✏️</button>
                              <button className="delete-btn" onClick={() => handleDeleteEvent(event._id)}>🗑️</button>
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

        {/* ── Fraud ─────────────────────────────────────────────────────── */}
        {view === 'fraud' && fraudAnalytics && (
          <div className="fraud-view">
            <h2>🚨 Fraud Risk Analytics</h2>
            <div className="fraud-summary-grid">
              {[
                { icon: '👥', label: 'Total Users',       val: fraudAnalytics.summary.totalUsers },
                { icon: '🔴', label: 'High Risk',         val: fraudAnalytics.summary.highRiskUsers,   cls: 'high-risk' },
                { icon: '🟡', label: 'Medium Risk',       val: fraudAnalytics.summary.mediumRiskUsers, cls: 'medium-risk' },
                { icon: '🟢', label: 'Low Risk',          val: fraudAnalytics.summary.lowRiskUsers,    cls: 'low-risk' },
                { icon: '📊', label: 'Avg Fraud Score',   val: fraudAnalytics.summary.avgFraudScore },
                { icon: '⚠️', label: 'Suspicious Rate',  val: `${fraudAnalytics.summary.suspiciousActivityRate}%` },
              ].map(({ icon, label, val, cls }) => (
                <div key={label} className={`fraud-card ${cls || ''}`}>
                  <div className="card-icon">{icon}</div>
                  <div className="card-content"><h4>{label}</h4><p className="card-value">{val}</p></div>
                </div>
              ))}
            </div>
            <div className="fraud-user-rankings">
              <h3>User Fraud Risk Rankings (Top 50)</h3>
              <div className="fraud-table-container">
                <table className="fraud-ranking-table">
                  <thead>
                    <tr>
                      <th>Risk</th><th>Name</th><th>Email</th><th>Score</th>
                      <th>Purchases</th><th>Tickets</th><th>Avg Qty</th><th>Spent</th><th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fraudAnalytics.userRankings.map((u, i) => (
                      <tr key={i} className={`risk-${u.riskLevel}`}>
                        <td><span className={`risk-badge ${u.riskLevel}`}>{u.riskLevel.toUpperCase()}</span></td>
                        <td>{u.userName}</td>
                        <td>{u.userEmail}</td>
                        <td>{u.fraudScore}</td>
                        <td>{u.totalPurchases}</td>
                        <td>{u.totalTickets}</td>
                        <td>{u.avgTicketsPerPurchase}</td>
                        <td>₹{u.totalSpent.toFixed(2)}</td>
                        <td>{u.flaggedReasons.length > 0 ? u.flaggedReasons.join('; ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
    <>
      <AdminDashboard {...props} />
      <Footer />
    </>
  );
}
