import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AdminEventForm from './AdminEventForm';
import API_URL from '../config/api';
import './AdminDashboard.css';

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState('stats');
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
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
          <div className="admin-user-info">
            <span>👤 {user?.name} ({user?.role})</span>
            <button className="logout-btn" onClick={logout}>Logout</button>
          </div>
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
      </nav>

      <main className="admin-content">
        {loading && <div className="loading">Loading...</div>}

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
                          <td>{formatDate(event.eventDate)}</td>
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
      </main>
    </div>
  );
}

export default AdminDashboard;
