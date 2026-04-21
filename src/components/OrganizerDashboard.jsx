import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AdminEventForm from './AdminEventForm';
import Footer from './Footer';
import { ENDPOINTS } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';
import './AdminDashboard.css'; // Reusing admin styles for consistency

function OrganizerDashboard() {
  const { user } = useAuth();
  const { connected, lastEvent } = useWebSocket();
  const [view, setView]   = useState('stats');
  const [stats, setStats] = useState(null);
  const [events, setEvents]               = useState([]);
  const [tickets, setTickets]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent]   = useState(null);
  
  // New: Search and Filtering state
  const [eventSearch, setEventSearch]   = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [organizerWallet, setOrganizerWallet] = useState({ balance: 0 });
  const [messageModal, setMessageModal] = useState({ isOpen: false, eventId: null, eventName: '', type: 'attendees', title: '', message: '' });

  // Helpers for Avatars
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().substring(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Real-time: refresh stats when a ticket is sold or attendance updates
  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'ticket_sold' && view === 'stats') {
      fetchStats();
    }
    if (lastEvent.type === 'attendance_update') {
      // Update the events list in-place for live progress feedback
      setEvents(currentEvents => currentEvents.map(ev => {
        if (ev._id === lastEvent.eventId) {
          return { ...ev, scannedCount: lastEvent.scannedCount, totalSold: lastEvent.totalSold };
        }
        return ev;
      }));
    }
  }, [lastEvent]); // eslint-disable-line

  useEffect(() => {
    if (view === 'events'  ? fetchEvents()  : null);
    if (view === 'tickets' ? fetchTickets() : null);
    fetchOrganizerWallet();
  }, [view]);

  const fetchOrganizerWallet = async () => {
    try {
      const { data } = await api.get(ENDPOINTS.WALLET_BALANCE);
      setOrganizerWallet(data);
    } catch (err) { console.error('Organizer wallet error:', err); }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ORGANIZER_STATS);
      setStats(data.stats);
    } catch (err) {
      console.error('Stats error:', err);
      // alert('Failed to fetch statistics');
    } finally { setLoading(false); }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ORGANIZER_EVENTS);
      setEvents(data.events);
    } catch (err) {
      console.error('Events error:', err);
      alert('Failed to fetch your events');
    } finally { setLoading(false); }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ORGANIZER_TICKETS);
      setTickets(data.tickets);
    } catch (err) {
      console.error('Tickets error:', err);
      alert('Failed to fetch ticket sales');
    } finally { setLoading(false); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageModal.title || !messageModal.message) return alert('Title and message required');
    try {
      setLoading(true);
      const endpoint = messageModal.type === 'admin' ? ENDPOINTS.ORGANIZER_MESSAGE_ADMIN : ENDPOINTS.ORGANIZER_BROADCAST;
      const payload = messageModal.type === 'admin' 
        ? { title: messageModal.title, message: messageModal.message }
        : { eventId: messageModal.eventId, title: messageModal.title, message: messageModal.message };

      await api.post(endpoint, payload);
      alert('Message sent successfully!');
      setMessageModal({ ...messageModal, isOpen: false, title: '', message: '' });
    } catch (err) {
      console.error('Messaging error:', err);
      alert(err.response?.data?.error || 'Failed to send message');
    } finally { setLoading(false); }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await api.delete(`${ENDPOINTS.EVENTS}/${eventId}`);
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
    <div className="admin-dashboard organizer-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>🎭 Organizer Dashboard</h1>
          <div className="admin-user-info">
             <span className={`ws-indicator ${connected ? 'ws-on' : 'ws-off'}`}
                title={connected ? 'Live updates connected' : 'Offline'}>
              {connected ? '🟢 Live' : '⚫ Offline'}
            </span>
            <div className="org-wallet-badge" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              💰 My Wallet: ₹{organizerWallet.balance.toFixed(2)}
            </div>
            <button 
              className="msg-admin-btn" 
              onClick={() => setMessageModal({ isOpen: true, type: 'admin', title: '', message: '' })}
              style={{ marginLeft: '10px', background: '#3498db', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
            >
              📧 Message Admin
            </button>
          </div>
        </div>
      </header>

      <nav className="admin-nav">
        <button className={view === 'stats'   ? 'active' : ''} onClick={() => setView('stats')}>📊 Statistics</button>
        <button className={view === 'events'  ? 'active' : ''} onClick={() => setView('events')}>🎭 My Events</button>
        <button className={view === 'tickets' ? 'active' : ''} onClick={() => setView('tickets')}>🎟️ Sales History</button>
      </nav>

      <main className="admin-content">
        {loading && <div className="loading">Loading...</div>}

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {view === 'stats' && stats && (
          <div className="stats-view">
            <h2 className="view-title">Dashboard Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon stats-blue">🎭</div>
                <div className="stat-info">
                  <h3>My Events</h3>
                  <p className="stat-value">{stats.totalEvents}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stats-indigo">🎟️</div>
                <div className="stat-info">
                  <h3>Total Tickets Sold</h3>
                  <p className="stat-value">{stats.totalTickets}</p>
                </div>
              </div>
              <div className="stat-card" style={{ border: '2px solid #2ecc71' }}>
                <div className="stat-icon stats-green">💰</div>
                <div className="stat-info">
                  <h3>My Available Balance</h3>
                  <p className="stat-value" style={{ color: '#2ecc71' }}>₹{organizerWallet.balance.toFixed(2)}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stats-green">💰</div>
                <div className="stat-info">
                  <h3>Total Revenue</h3>
                  <p className="stat-value">₹{stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stats-purple">📈</div>
                <div className="stat-info">
                  <h3>Avg. Conversion</h3>
                  <p className="stat-value">{stats.totalEvents > 0 ? (stats.totalTickets / stats.totalEvents).toFixed(1) : '0'}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon stats-orange">🛂</div>
                <div className="stat-info">
                  <h3>Total Attendance</h3>
                  <p className="stat-value">
                    {events.reduce((sum, ev) => sum + (ev.scannedCount || 0), 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Events ────────────────────────────────────────────────────── */}
        {view === 'events' && (
          <div className="events-view">
            <div className="view-header-row">
              <h2 className="view-title">My Event Listings</h2>
              <div className="header-actions">
                <div className="search-box-container">
                  <span className="search-icon">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search by event name or venue..." 
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
                    <p>{eventSearch ? 'No events match your search.' : "You haven't created any events yet."}</p>
                    {!eventSearch && <button className="link-btn" onClick={() => setShowEventForm(true)}>Host your first event</button>}
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
                            <div className="entry-progress-mini">
                              Checked-in: <b>{event.scannedCount || 0}</b> / {event.ticketsSold}
                            </div>
                          </td>
                          <td className="base-revenue-cell">
                            <div className="amount-dim">₹{(event.baseRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </td>
                          <td className="revenue-cell">
                            <div className="amount-bold">₹{(event.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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
                              <button className="msg-btn" onClick={() => setMessageModal({ isOpen: true, type: 'attendees', eventId: event._id, eventName: event.name, title: '', message: '' })} title="Message Attendees" style={{ background: '#9b59b6', border: 'none', borderRadius: '4px', padding: '5px', cursor: 'pointer' }}>💬</button>
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
            <div className="view-header-row">
              <h2 className="view-title">🎟️ Sales Transaction History</h2>
              <div className="header-actions">
                <div className="search-box-container">
                  <span className="search-icon">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search by customer name, email or ref..." 
                    className="admin-search-input"
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                  />
                  {ticketSearch && (
                    <button className="clear-search" onClick={() => setTicketSearch('')}>✕</button>
                  )}
                </div>
                <button className="refresh-btn" onClick={fetchTickets}>🔄 Refresh</button>
              </div>
            </div>

            {tickets.filter(t => 
              t.customerName?.toLowerCase().includes(ticketSearch.toLowerCase()) || 
              t.customerEmail?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
              t.bookingReference?.toLowerCase().includes(ticketSearch.toLowerCase())
            ).length === 0 ? (
              <div className="no-data">
                <p>{ticketSearch ? 'No transactions match your search.' : 'No tickets sold for your events yet.'}</p>
              </div>
            ) : (
              <div className="tickets-table-container">
                <table className="admin-table tickets-table high-contrast-table">
                  <thead>
                    <tr>
                      <th>Booking Ref</th>
                      <th>Customer</th>
                      <th>Event & Category</th>
                      <th>Qty</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                      <th>Purchase Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets
                      .filter(t => 
                        t.customerName?.toLowerCase().includes(ticketSearch.toLowerCase()) || 
                        t.customerEmail?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
                        t.bookingReference?.toLowerCase().includes(ticketSearch.toLowerCase())
                      )
                      .map((t) => (
                      <tr key={t._id}>
                        <td className="booking-ref-cell">
                          <code>{t.bookingReference}</code>
                        </td>
                        <td className="customer-cell">
                          <div className="user-avatar-info">
                            <div className="user-initials-circle" style={{ backgroundColor: getAvatarColor(t.customerName) }}>
                              {getInitials(t.customerName)}
                            </div>
                            <div className="user-details-text">
                              <div className="user-main-name">{t.customerName}</div>
                              <div className="user-sub-email">{t.customerEmail}</div>
                            </div>
                          </div>
                        </td>
                        <td className="event-cat-cell">
                          <div className="event-name-link">{t.eventId?.name || 'Unknown Event'}</div>
                          <span className={`cat-pill ${t.categoryName || 'standard'}`}>
                            {t.categoryName?.toUpperCase() || 'STANDARD'}
                          </span>
                        </td>
                        <td className="qty-cell">
                          <span className="qty-count">×{t.quantity}</span>
                        </td>
                        <td className="amount-cell">
                          <div className="amount-highlight">₹{t.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </td>
                        <td>
                          <span className={`status-pill ${t.status || 'confirmed'}`}>
                            {(t.status || 'confirmed').toUpperCase()}
                          </span>
                        </td>
                        <td className="date-cell-small">
                          {fmtDate(t.purchaseDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {messageModal.isOpen && (
        <div className="modal-overlay">
          <div className="org-msg-modal">
            <h3>{messageModal.type === 'admin' ? '📧 Contact Platform Admin' : `💬 Message Attendees: ${messageModal.eventName}`}</h3>
            <form onSubmit={handleSendMessage}>
              <div className="form-group">
                <label>Subject</label>
                <input 
                  type="text" 
                  value={messageModal.title} 
                  onChange={(e) => setMessageModal({ ...messageModal, title: e.target.value })}
                  placeholder={messageModal.type === 'admin' ? 'Issue description...' : 'Important Update...'}
                />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea 
                  rows="5"
                  value={messageModal.message} 
                  onChange={(e) => setMessageModal({ ...messageModal, message: e.target.value })}
                  placeholder="Type your message here..."
                ></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setMessageModal({ ...messageModal, isOpen: false })}>Cancel</button>
                <button type="submit" className="send-btn" disabled={loading}>{loading ? 'Sending...' : 'Send Message'}</button>
              </div>
            </form>
          </div>
          <style>{`
            .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2000; }
            .org-msg-modal { background: #1a1a1a; padding: 25px; border-radius: 12px; width: 100%; max-width: 500px; border: 1px solid #333; }
            .org-msg-modal h3 { margin-bottom: 20px; color: #fff; font-size: 1.2rem; }
            .org-msg-modal .form-group { margin-bottom: 15px; }
            .org-msg-modal label { display: block; margin-bottom: 5px; color: #aaa; font-size: 0.9rem; }
            .org-msg-modal input, .org-msg-modal textarea { width: 100%; padding: 10px; background: #222; border: 1px solid #444; color: #fff; border-radius: 4px; }
            .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .cancel-btn { background: #444; color: #fff; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; }
            .send-btn { background: #9b59b6; color: #fff; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default function OrganizerDashboardWrapper(props) {
  return (
    <>
      <OrganizerDashboard {...props} />
    </>
  );
}
