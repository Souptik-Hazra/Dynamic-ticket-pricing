import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AdminEventForm from './AdminEventForm';
import EventMapModal from './EventMapModal';
import { ENDPOINTS } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';

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
    const eventTimer = setTimeout(() => {
      if (!lastEvent) return;
      if (lastEvent.type === 'ticket_sold') {
        if (view === 'stats') fetchStats();
        fetchOrganizerWallet();
      }
      if (lastEvent.type === 'notification') {
        fetchOrganizerWallet();
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
    }, 0);
    return () => clearTimeout(eventTimer);
  }, [lastEvent]); // eslint-disable-line

  useEffect(() => {
    const viewTimer = setTimeout(() => {
      // Fetch view-specific data when the view changes
      if (view === 'events') fetchEvents();
      if (view === 'tickets') fetchTickets();
      if (view === 'stats') fetchStats();
    }, 0);
    return () => clearTimeout(viewTimer);
  }, [view]);

  // Wallet fetch: run on mount and when the authenticated user changes.
  // Throttle to avoid rapid repeated requests (rate-limit protection client-side).
  const lastWalletFetchRef = React.useRef(0);
  const WALLET_THROTTLE_MS = 5000;

  useEffect(() => {
    const walletTimer = setTimeout(() => {
      const now = Date.now();
      if (now - lastWalletFetchRef.current < WALLET_THROTTLE_MS) return;
      lastWalletFetchRef.current = now;
      fetchOrganizerWallet();
    }, 0);
    return () => clearTimeout(walletTimer);
  }, [user?.id]);

  async function fetchOrganizerWallet() {
    // Exponential backoff retries for transient errors (429 / network blips)
    const maxAttempts = 4;
    let attempt = 0;
    let lastErr = null;
    while (attempt < maxAttempts) {
      try {
        const { data } = await api.get(ENDPOINTS.WALLET_BALANCE);
        setOrganizerWallet(data);
        return;
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;
        // If client error other than 429, don't retry
        if (status && status !== 429) break;
        attempt += 1;
        const backoff = Math.min(500 * Math.pow(2, attempt - 1), 5000);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    if (lastErr) console.error('Organizer wallet error:', lastErr);
  };

  async function fetchStats() {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ORGANIZER_STATS);
      setStats(data.stats);
    } catch (err) {
      console.error('Stats error:', err);
      // alert('Failed to fetch statistics');
    } finally { setLoading(false); }
  };

  async function fetchEvents() {
    try {
      setLoading(true);
      const { data } = await api.get(ENDPOINTS.ORGANIZER_EVENTS);
      setEvents(data.events);
    } catch (err) {
      console.error('Events error:', err);
      alert('Failed to fetch your events');
    } finally { setLoading(false); }
  };

  async function fetchTickets() {
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

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapEvent, setMapEvent] = useState(null);
  const openMapForEvent = (event) => { setMapEvent(event); setShowMapModal(true); };

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '1.5rem 0' }}>
      <header className="flex-between" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 className="title-main text-gradient" style={{ margin: 0 }}>🎭 Organizer Hub</h1>
          <p className="text-muted">Event Intelligence & Management</p>
        </div>
        <div className="flex-center" style={{ gap: '1.5rem' }}>
           <span className={`cyber-badge ${connected ? 'badge-success' : 'badge-danger'}`}
                title={connected ? 'Live updates connected' : 'Offline'}>
              {connected ? '● Live WebSocket' : '● Offline'}
            </span>
            <div className="glass-panel" style={{ padding: '0.6rem 1.25rem', borderRadius: '12px' }}>
              <span className="cyber-label" style={{ fontSize: '0.7rem', display: 'block' }}>Net Revenue</span>
              <span className="text-glow" style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--success)' }}>
                ₹{organizerWallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button 
              className="cyber-btn btn-primary" 
              onClick={() => setMessageModal({ isOpen: true, type: 'admin', title: '', message: '' })}
              style={{ padding: '0.6rem 1rem', fontSize: '0.75rem' }}
            >
              📧 Message Admin
            </button>
        </div>
      </header>

      <div className="cyber-grid" style={{ gridTemplateColumns: '220px 1fr', gap: '2rem' }}>
        {/* Navigation Sidebar */}
        <nav className="cyber-sidebar">
          {[
            { id: 'stats', label: '📊 Metrics Overview' },
            { id: 'events', label: '🎭 My Events' },
            { id: 'tickets', label: '🎟️ Sales Registry' }
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

        <main>
          {loading && (
            <div className="flex-center" style={{ padding: '3rem' }}>
              <div className="text-glow animate-pulse">Synchronizing ledger...</div>
            </div>
          )}

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {view === 'stats' && stats && (
          <div className="animate-fade-up">
            <h2 className="title-sub">Neural Performance Metrics</h2>
            <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--accent-cyan)' }}>
                <span className="cyber-label" style={{ fontSize: '0.65rem' }}>Active Events</span>
                <p className="text-glow" style={{ fontSize: '1.5rem', fontWeight: '900' }}>{stats.totalEvents}</p>
              </div>
              <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--accent-indigo)' }}>
                <span className="cyber-label" style={{ fontSize: '0.65rem' }}>Total Tickets Sold</span>
                <p className="text-glow" style={{ fontSize: '1.5rem', fontWeight: '900' }}>{stats.totalTickets}</p>
              </div>
              <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--success)' }}>
                <span className="cyber-label">Gross Revenue</span>
                <p className="text-gradient" style={{ fontSize: '1.6rem', fontWeight: '900' }}>₹{stats.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="cyber-card cyber-stat-card flex-center" style={{ borderLeftColor: 'var(--accent-pink)' }}>
                <span className="cyber-label">Avg. Conversion</span>
                <p className="text-glow" style={{ fontSize: '1.8rem', fontWeight: '900' }}>
                  {stats.totalEvents > 0 ? (stats.totalTickets / stats.totalEvents).toFixed(1) : '0'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Events ────────────────────────────────────────────────────── */}
        {view === 'events' && (
          <div className="animate-fade-up">
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
              <h2 className="title-sub" style={{ margin: 0 }}>My Event Listings</h2>
              <div className="flex-center" style={{ gap: '1.5rem' }}>
                <div className="cyber-form-group" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', padding: '0.2rem 1rem' }}>
                  <span className="text-dim">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Filter events..." 
                    className="cyber-input"
                    style={{ background: 'transparent', border: 'none', width: '200px' }}
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                  />
                </div>
                <button className="cyber-btn btn-primary" onClick={() => { setEditingEvent(null); setShowEventForm(true); }}>
                  ➕ NEW EVENT
                </button>
              </div>
            </div>

            {showEventForm && (
              <AdminEventForm event={editingEvent} onClose={handleEventFormClose} />
            )}

            {!showEventForm && (
              <div className="cyber-table-container">
                <table className="cyber-table">
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
                              <div className="text-dim" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                                Checked-in: <b>{event.scannedCount || 0}</b>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="text-dim" style={{ fontSize: '0.75rem' }}>Base: ₹{(event.baseRevenue || 0).toLocaleString()}</div>
                          </td>
                          <td>
                            <div className="text-main" style={{ fontWeight: '800', color: 'var(--success)' }}>₹{(event.totalRevenue || 0).toLocaleString()}</div>
                          </td>
                          <td>
                            <div style={{ color: 'var(--accent-cyan)', fontWeight: '800' }}>+₹{event.profitAmount?.toFixed(0)}</div>
                            <div className="text-dim" style={{ fontSize: '0.75rem' }}>({event.profitPercentage?.toFixed(1)}%)</div>
                          </td>
                          <td>
                            <span className={`cyber-badge badge-${event.status}`}>{event.status.toUpperCase()}</span>
                          </td>
                          <td>
                            <div className="flex-center" style={{ gap: '0.5rem' }}>
                              <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => openMapForEvent(event)} title="Map">🗺️</button>
                              <button className="cyber-btn btn-outline" style={{ padding: '0.4rem', background: 'rgba(155, 89, 182, 0.2)' }} onClick={() => setMessageModal({ isOpen: true, type: 'attendees', eventId: event._id, eventName: event.name, title: '', message: '' })} title="Message">💬</button>
                              <button className="cyber-btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => { setEditingEvent(event); setShowEventForm(true); }} title="Edit">✏️</button>
                              <button className="cyber-btn btn-danger" style={{ padding: '0.4rem' }} onClick={() => handleDeleteEvent(event._id)} title="Delete">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {showMapModal && <EventMapModal event={mapEvent} onClose={() => setShowMapModal(false)} />}
            </div>
          )}

        {/* ── Tickets ───────────────────────────────────────────────────── */}
        {view === 'tickets' && (
          <div className="animate-fade-up">
            <div className="flex-between" style={{ marginBottom: '2rem' }}>
              <h2 className="title-sub" style={{ margin: 0 }}>🎟️ Sales Transaction History</h2>
              <div className="flex-center" style={{ gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '0.2rem 1rem', display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '0.5rem' }}>🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search transactions..." 
                    className="cyber-input"
                    style={{ border: 'none', background: 'transparent' }}
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                  />
                </div>
                <button className="cyber-btn btn-outline" onClick={fetchTickets}>🔄 Sync</button>
              </div>
            </div>

            {tickets.filter(t => 
              t.customerName?.toLowerCase().includes(ticketSearch.toLowerCase()) || 
              t.customerEmail?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
              t.bookingReference?.toLowerCase().includes(ticketSearch.toLowerCase())
            ).length === 0 ? (
              <div className="flex-center" style={{ padding: '5rem', border: '1px dashed var(--border-dim)', borderRadius: '20px' }}>
                <p className="text-dim">{ticketSearch ? 'No transactions match your query.' : 'No sales recorded yet.'}</p>
              </div>
            ) : (
              <div className="cyber-table-container">
                <table className="cyber-table">
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
                        <td><code>{t.bookingReference}</code></td>
                        <td>
                          <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.8rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: getAvatarColor(t.customerName), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800', color: 'white' }}>
                              {getInitials(t.customerName)}
                            </div>
                            <div className="flex-column">
                              <span className="text-main" style={{ fontWeight: '700', fontSize: '0.85rem' }}>{t.customerName}</span>
                              <span className="text-dim" style={{ fontSize: '0.7rem' }}>{t.customerEmail}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-main" style={{ fontSize: '0.85rem' }}>{t.eventId?.name || 'Unknown Event'}</div>
                          <span className="cyber-badge badge-info" style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem' }}>{t.categoryName?.toUpperCase()}</span>
                        </td>
                        <td><span className="text-main" style={{ fontWeight: '800' }}>×{t.quantity}</span></td>
                        <td><span style={{ color: 'var(--success)', fontWeight: '800' }}>₹{t.totalAmount?.toLocaleString()}</span></td>
                        <td><span className={`cyber-badge badge-${t.status || 'success'}`}>{(t.status || 'confirmed').toUpperCase()}</span></td>
                        <td><span className="text-dim" style={{ fontSize: '0.75rem' }}>{fmtDate(t.purchaseDate)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </main>
      </div>

      {messageModal.isOpen && (
        <div className="cyber-overlay animate-fade-up">
          <div className="cyber-modal animate-fade-up" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0 }}>{messageModal.type === 'admin' ? '📧 Contact Platform Admin' : `💬 Message Attendees`}</h3>
              <button className="cyber-btn btn-outline" style={{ padding: '0.4rem', borderRadius: '50%' }} onClick={() => setMessageModal({ ...messageModal, isOpen: false })}>&times;</button>
            </header>
            <div className="modal-content">
              <form onSubmit={handleSendMessage} className="flex-column" style={{ gap: '1.5rem' }}>
                <div className="cyber-form-group">
                  <label className="cyber-label">Subject</label>
                  <input 
                    className="cyber-input"
                    type="text" 
                    value={messageModal.title} 
                    onChange={(e) => setMessageModal({ ...messageModal, title: e.target.value })}
                    placeholder={messageModal.type === 'admin' ? 'Issue description...' : 'Important Update...'}
                    required
                  />
                </div>
                <div className="cyber-form-group">
                  <label className="cyber-label">Message</label>
                  <textarea 
                    className="cyber-input"
                    rows="5"
                    value={messageModal.message} 
                    onChange={(e) => setMessageModal({ ...messageModal, message: e.target.value })}
                    placeholder="Type your message here..."
                    required
                  ></textarea>
                </div>
                <div className="flex-center" style={{ gap: '1rem', marginTop: '1rem' }}>
                  <button type="button" className="cyber-btn btn-outline" style={{ flex: 1 }} onClick={() => setMessageModal({ ...messageModal, isOpen: false })}>Cancel</button>
                  <button type="submit" className="cyber-btn btn-primary" style={{ flex: 2 }} disabled={loading}>{loading ? 'Sending...' : 'Send Message'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrganizerDashboard;
