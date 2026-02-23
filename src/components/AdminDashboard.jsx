import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AdminEventForm from './AdminEventForm';
import { API_URL } from '../config/api';
import './AdminDashboard.css';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState('stats');
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [fraudAnalytics, setFraudAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Get auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  useEffect(() => {
    if (view === 'stats') {
      fetchStats();
    } else if (view === 'events') {
      fetchEvents();
    } else if (view === 'tickets') {
      fetchTickets();
    } else if (view === 'fraud') {
      fetchFraudAnalytics();
    }
  }, [view]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/admin/stats`, getAuthHeaders());
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      alert('Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/admin/events`, getAuthHeaders());
      setEvents(response.data.events);
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/admin/tickets`, getAuthHeaders());
      setTickets(response.data.tickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      alert('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchFraudAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/admin/fraud-analytics`, getAuthHeaders());
      setFraudAnalytics(response.data.fraudAnalytics);
    } catch (error) {
      console.error('Error fetching fraud analytics:', error);
      alert('Failed to fetch fraud analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/admin/events/${eventId}`);
      alert('Event deleted successfully');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const handleEventFormClose = (refresh) => {
    setShowEventForm(false);
    setEditingEvent(null);
    if (refresh) {
      fetchEvents();
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <h1>🎫 Admin Dashboard</h1>
        </div>
      </header>

      <nav className="admin-nav">
        <button 
          className={view === 'stats' ? 'active' : ''} 
          onClick={() => setView('stats')}
        >
          📊 Statistics
        </button>
        <button 
          className={view === 'events' ? 'active' : ''} 
          onClick={() => setView('events')}
        >
          🎭 Manage Events
        </button>
        <button 
          className={view === 'tickets' ? 'active' : ''} 
          onClick={() => setView('tickets')}
        >
          🎟️ Ticket Buyers
        </button>
        <button 
          className={view === 'fraud' ? 'active' : ''} 
          onClick={() => setView('fraud')}
        >
          🚨 Fraud Analytics
        </button>
          // ...existing code...
      </nav>

      <main className="admin-content">
        {loading && <div className="loading">Loading...</div>}

        // ...existing code...

        {view === 'stats' && stats && (
          <div className="stats-view">
            <h2>System Statistics</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🎭</div>
                <div className="stat-info">
                  <h3>Total Events</h3>
                  <p className="stat-value">{stats.totalEvents}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h3>Total Users</h3>
                  <p className="stat-value">{stats.totalUsers}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">🎟️</div>
                <div className="stat-info">
                  <h3>Tickets Sold</h3>
                  <p className="stat-value">{stats.totalTickets}</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <h3>Total Revenue</h3>
                  <p className="stat-value">₹{stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {stats.recentTickets && stats.recentTickets.length > 0 && (
              <div className="recent-tickets">
                <h3>Recent Ticket Purchases</h3>
                <div className="tickets-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Event</th>
                        <th>Quantity</th>
                        <th>Amount</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentTickets.map(ticket => (
                        <tr key={ticket._id}>
                          <td>{ticket.customerName}</td>
                          <td>{ticket.event?.name || 'N/A'}</td>
                          <td>{ticket.quantity}</td>
                          <td>₹{ticket.totalAmount.toFixed(2)}</td>
                          <td>{formatDate(ticket.purchaseDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'events' && (
          <div className="events-view">
            <div className="events-header">
              <h2>Event Management</h2>
              <button className="create-event-btn" onClick={handleCreateEvent}>
                ➕ Create New Event
              </button>
            </div>

            {showEventForm && (
              <AdminEventForm 
                event={editingEvent}
                onClose={handleEventFormClose}
              />
            )}

            {!showEventForm && (
              <div className="events-list">
                {events.length === 0 ? (
                  <p className="no-events">No events found. Create one to get started!</p>
                ) : (
                  <table className="events-table">
                    <thead>
                      <tr>
                        <th>Event Name</th>
                        <th>Venue</th>
                        <th>Date</th>
                        <th>Capacity</th>
                        <th>Sold</th>
                        <th>Base Revenue</th>
                        <th>Actual Revenue</th>
                        <th>Profit Margin</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map(event => (
                        <tr key={event._id}>
                          <td><strong>{event.name}</strong></td>
                          <td>{event.venue}</td>
                          <td>
                            {event.startDate
                              ? (() => {
                                  const fmt = { month: 'short', day: 'numeric', year: 'numeric' };
                                  const start = new Date(event.startDate).toLocaleDateString('en-US', fmt);
                                  const end = event.endDate ? new Date(event.endDate).toLocaleDateString('en-US', fmt) : null;
                                  return end && end !== start ? `${start} - ${end}` : start;
                                })()
                              : 'N/A'}
                          </td>
                          <td>{event.capacity}</td>
                          <td>{event.ticketsSold}</td>
                          <td>₹{event.baseRevenue?.toFixed(2) || '0.00'}</td>
                          <td>₹{event.totalRevenue?.toFixed(2) || '0.00'}</td>
                          <td>
                            <span className={`profit-badge ${event.profitAmount > 0 ? 'positive' : event.profitAmount < 0 ? 'negative' : 'neutral'}`}>
                              {event.profitAmount > 0 ? '+' : ''}₹{event.profitAmount?.toFixed(2) || '0.00'}
                              <small> ({event.profitPercentage?.toFixed(1) || 0}%)</small>
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${event.status}`}>
                              {event.status}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="edit-btn"
                                onClick={() => handleEditEvent(event)}
                              >
                                ✏️
                              </button>
                              <button 
                                className="delete-btn"
                                onClick={() => handleDeleteEvent(event._id)}
                              >
                                🗑️
                              </button>
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

        {/* Tickets/Buyers View */}
        {view === 'tickets' && (
          <div className="tickets-view">
            <div className="view-header">
              <h2>🎟️ Ticket Buyers</h2>
              <button className="refresh-btn" onClick={fetchTickets}>
                🔄 Refresh
              </button>
            </div>

            {tickets.length === 0 ? (
              <div className="no-data">
                <p>No tickets sold yet.</p>
              </div>
            ) : (
              <div className="tickets-table-container">
                <table className="admin-table tickets-table">
                  <thead>
                    <tr>
                      <th>Booking Ref</th>
                      <th>Buyer Name</th>
                      <th>Email</th>
                      <th>Event</th>
                      <th>Category</th>
                      <th>Qty</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Purchase Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket._id}>
                        <td className="booking-ref">{ticket.bookingReference}</td>
                        <td className="buyer-name">{ticket.buyerName}</td>
                        <td className="buyer-email">{ticket.buyerEmail}</td>
                        <td>{ticket.eventName}</td>
                        <td>
                          <span className={`category-badge ${ticket.categoryName}`}>
                            {ticket.categoryName?.toUpperCase()}
                          </span>
                        </td>
                        <td>{ticket.quantity}</td>
                        <td className="amount">₹{ticket.totalAmount?.toFixed(2)}</td>
                        <td>
                          <span className={`status-badge ${ticket.status}`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td>{formatDate(ticket.purchaseDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="tickets-summary">
              <div className="summary-card">
                <span className="label">Total Tickets</span>
                <span className="value">{tickets.reduce((sum, t) => sum + t.quantity, 0)}</span>
              </div>
              <div className="summary-card">
                <span className="label">Total Revenue</span>
                <span className="value">₹{tickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0).toFixed(2)}</span>
              </div>
              <div className="summary-card">
                <span className="label">Unique Buyers</span>
                <span className="value">{new Set(tickets.map(t => t.buyerEmail)).size}</span>
              </div>
            </div>
          </div>
        )}

        {view === 'fraud' && fraudAnalytics && (
          <div className="fraud-view">
            <h2>🚨 Fraud Risk Analytics</h2>
            
            {/* Fraud Summary Cards */}
            <div className="fraud-summary-grid">
              <div className="fraud-card">
                <div className="card-icon">👥</div>
                <div className="card-content">
                  <h4>Total Users</h4>
                  <p className="card-value">{fraudAnalytics.summary.totalUsers}</p>
                </div>
              </div>
              
              <div className="fraud-card high-risk">
                <div className="card-icon">🔴</div>
                <div className="card-content">
                  <h4>High Risk Users</h4>
                  <p className="card-value">{fraudAnalytics.summary.highRiskUsers}</p>
                </div>
              </div>
              
              <div className="fraud-card medium-risk">
                <div className="card-icon">🟡</div>
                <div className="card-content">
                  <h4>Medium Risk Users</h4>
                  <p className="card-value">{fraudAnalytics.summary.mediumRiskUsers}</p>
                </div>
              </div>
              
              <div className="fraud-card low-risk">
                <div className="card-icon">🟢</div>
                <div className="card-content">
                  <h4>Low Risk Users</h4>
                  <p className="card-value">{fraudAnalytics.summary.lowRiskUsers}</p>
                </div>
              </div>
              
              <div className="fraud-card">
                <div className="card-icon">📊</div>
                <div className="card-content">
                  <h4>Avg Fraud Score</h4>
                  <p className="card-value">{fraudAnalytics.summary.avgFraudScore}</p>
                </div>
              </div>
              
              <div className="fraud-card">
                <div className="card-icon">⚠️</div>
                <div className="card-content">
                  <h4>Suspicious Activity Rate</h4>
                  <p className="card-value">{fraudAnalytics.summary.suspiciousActivityRate}%</p>
                </div>
              </div>
            </div>

            {/* Timeline Chart */}
            {fraudAnalytics.timeline && fraudAnalytics.timeline.length > 0 && (
              <div className="fraud-timeline">
                <h3>Fraud Timeline (Last 30 Days)</h3>
                <div className="timeline-chart">
                  {fraudAnalytics.timeline.map((day, idx) => (
                    <div key={idx} className="timeline-bar">
                      <div className="bar-container">
                        {day.high > 0 && <div className="bar-segment high-risk" style={{height: `${(day.high / day.total) * 100}%`}} title={`High Risk: ${day.high}`}></div>}
                        {day.medium > 0 && <div className="bar-segment medium-risk" style={{height: `${(day.medium / day.total) * 100}%`}} title={`Medium Risk: ${day.medium}`}></div>}
                        {day.low > 0 && <div className="bar-segment low-risk" style={{height: `${(day.low / day.total) * 100}%`}} title={`Low Risk: ${day.low}`}></div>}
                      </div>
                      <span className="bar-date">{new Date(day.date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>
                    </div>
                  ))}
                </div>
                <div className="timeline-legend">
                  <div><span className="legend-color high-risk"></span> High Risk</div>
                  <div><span className="legend-color medium-risk"></span> Medium Risk</div>
                  <div><span className="legend-color low-risk"></span> Low Risk</div>
                </div>
              </div>
            )}

            {/* User Fraud Risk Ranking Table */}
            <div className="fraud-user-rankings">
              <h3>User Fraud Risk Rankings (Top 50)</h3>
              <div className="fraud-table-container">
                <table className="fraud-ranking-table">
                  <thead>
                    <tr>
                      <th>Risk Level</th>
                      <th>User Name</th>
                      <th>Email</th>
                      <th>Fraud Score</th>
                      <th>Total Purchases</th>
                      <th>Total Tickets</th>
                      <th>Avg Qty/Purchase</th>
                      <th>Total Spent</th>
                      <th>Flagged Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fraudAnalytics.userRankings.map((user, idx) => (
                      <tr key={idx} className={`risk-${user.riskLevel}`}>
                        <td>
                          <span className={`risk-badge ${user.riskLevel}`}>
                            {user.riskLevel.toUpperCase()}
                          </span>
                        </td>
                        <td className="user-name">{user.userName}</td>
                        <td className="user-email">{user.userEmail}</td>
                        <td className="fraud-score">{user.fraudScore}</td>
                        <td>{user.totalPurchases}</td>
                        <td>{user.totalTickets}</td>
                        <td>{user.avgTicketsPerPurchase.toFixed(1)}</td>
                        <td className="total-spent">₹{user.totalSpent.toFixed(2)}</td>
                        <td className="flags">
                          {user.flaggedReasons.length > 0 ? (
                            <div className="flag-list">
                              {user.flaggedReasons.map((reason, i) => (
                                <div key={i} className="flag-item">{reason}</div>
                              ))}
                            </div>
                          ) : (
                            <span className="no-flags">No flags</span>
                          )}
                        </td>
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

  import Footer from './Footer';

  export default function AdminDashboardWrapper(props) {
    return (
      <>
        <AdminDashboard {...props} />
        <Footer />
      </>
    );
  }
