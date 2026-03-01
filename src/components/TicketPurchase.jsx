import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import './TicketPurchase.css';

function TicketPurchase({ event, onBack, onSuccess }) {
  const { user, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    quantity: 1
  });
  const [loading, setLoading] = useState(false);
  const [purchasedTicket, setPurchasedTicket] = useState(null);

  // Pre-fill user data if logged in
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        customerName: user.name || '',
        customerEmail: user.email || ''
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getPrice = () => {
    return event.ticketPrice || 0;
  };

  const getAvailableTickets = () => {
    return event.availableTickets || 0;
  };

  const calculateTotal = () => {
    return getPrice() * formData.quantity;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return; // Prevent double submission

    if (!isAuthenticated) {
      alert('Please login to purchase tickets');
      return;
    }

    const available = getAvailableTickets();
    if (formData.quantity > 15) {
      alert('You can purchase a maximum of 15 tickets per event.');
      return;
    }
    if (formData.quantity > available) {
      alert(`Only ${available} tickets available!`);
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/tickets`,
        {
          eventId: event._id,
          ...formData,
          quantity: parseInt(formData.quantity),
          pricePerTicket: getPrice()
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setLoading(false);
      setPurchasedTicket({
        ...response.data.ticket,
        eventName: event.name,
        eventVenue: event.venue,
        eventImage: event.image,
        eventCategory: event.category,
        eventDate: event.date,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
      });
    } catch (error) {
      setLoading(false);
      console.error('Purchase error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Purchase failed. Please try again.';
      alert(`❌ ${errorMessage}`);
    }
  };

  const handleClosePurchasedTicket = () => {
    setPurchasedTicket(null);
    onSuccess();
  };

  const handlePrintPurchasedTicket = () => {
    window.print();
  };

  return (
    <div className="ticket-purchase-container bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <button className="back-button" onClick={onBack}>
        ← Back to Events
      </button>

      <div className="purchase-content">
        <div className="event-summary">
          <img src={event.image} alt={event.name} />
          <h2>{event.name}</h2>
          <p className="venue">📍 {event.venue}</p>
          <p className="date">
            📅 {event.date
              ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              : 'Date not set'}
          </p>
          <p className="category-tag">🎭 {event.category}</p>
        </div>

        <div className="purchase-form-section">
          {/* Ticket Information Section */}
          <div className="ticket-info">
            <h3>🎟️ Ticket Details</h3>
            <div className="ticket-details">
              <div className="detail-row">
                <span className="detail-label">Ticket Price:</span>
                <span className="detail-value">₹{getPrice()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Available Tickets:</span>
                <span className="detail-value">{getAvailableTickets()} remaining</span>
              </div>
            </div>
          </div>

          <h3>📝 Your Details</h3>
          
          <form onSubmit={handleSubmit} className="purchase-form">
            <div className="form-group">
              <label htmlFor="customerName">Full Name *</label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="customerEmail">Email Address *</label>
              <input
                type="email"
                id="customerEmail"
                name="customerEmail"
                value={formData.customerEmail}
                onChange={handleChange}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="quantity">Number of Tickets * <small>(max 15 per purchase)</small></label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                min="1"
                max={Math.min(15, getAvailableTickets())}
                required
              />
            </div>

            <div className="order-summary">
              <h4>📋 Order Summary</h4>
              <div className="summary-row">
                <span>Price per ticket:</span>
                <span>₹{getPrice().toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Quantity:</span>
                <span>× {formData.quantity}</span>
              </div>
              <div className="summary-row total">
                <span>Total Amount:</span>
                <span>₹{calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {!isAuthenticated && (
              <div className="login-warning">
                ⚠️ Please login to purchase tickets
              </div>
            )}

            <button 
              type="submit" 
              className="purchase-button"
              disabled={loading || getAvailableTickets() === 0 || !isAuthenticated}
            >
              {loading ? 'Processing...' : 
               !isAuthenticated ? 'Login to Purchase' :
               getAvailableTickets() === 0 ? 'Sold Out' :
               `Purchase for ₹${calculateTotal().toFixed(2)}`}
            </button>
          </form>
        </div>
      </div>

      {/* Purchased Ticket Modal */}
      {purchasedTicket && (
        <div className="purchase-print-overlay" onClick={handleClosePurchasedTicket}>
          <div className="purchase-print-modal" onClick={(e) => e.stopPropagation()}>
            <div className="purchase-print-content" id="printable-purchase-ticket">
              {/* Header */}
              <div className="pp-header">
                <div className="pp-brand">
                  <span className="pp-brand-icon">🎫</span>
                  <span className="pp-brand-name">FanFeverTickets</span>
                </div>
                <div className="pp-badge">E-TICKET</div>
              </div>

              {/* Success Banner */}
              <div className="pp-success-banner">
                <span className="pp-success-icon">✅</span>
                <span>Payment Successful!</span>
              </div>

              {/* Event Image */}
              {purchasedTicket.eventImage && (
                <div className="pp-event-image">
                  <img
                    src={purchasedTicket.eventImage}
                    alt={purchasedTicket.eventName}
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                </div>
              )}

              {/* Event Info */}
              <div className="pp-event-info">
                <h2 className="pp-event-name">{purchasedTicket.eventName}</h2>
                <div className="pp-event-details">
                  {purchasedTicket.eventVenue && (
                    <div className="pp-row">
                      <span className="pp-label">📍 Venue</span>
                      <span className="pp-value">{purchasedTicket.eventVenue}</span>
                    </div>
                  )}
                  {purchasedTicket.eventDate && (
                    <div className="pp-row">
                      <span className="pp-label">📅 Date</span>
                      <span className="pp-value">
                        {new Date(purchasedTicket.eventDate).toLocaleDateString('en-US', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  {purchasedTicket.eventCategory && (
                    <div className="pp-row">
                      <span className="pp-label">🎭 Category</span>
                      <span className="pp-value">
                        {purchasedTicket.eventCategory.charAt(0).toUpperCase() + purchasedTicket.eventCategory.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="pp-divider"></div>

              {/* Ticket Details */}
              <div className="pp-detail-grid">
                <div className="pp-detail-box">
                  <span className="pp-box-label">Booking Reference</span>
                  <span className="pp-box-value pp-ref">
                    {purchasedTicket.bookingReference || purchasedTicket._id}
                  </span>
                </div>
                <div className="pp-detail-box">
                  <span className="pp-box-label">Ticket Type</span>
                  <span className="pp-box-value">STANDARD</span>
                </div>
                <div className="pp-detail-box">
                  <span className="pp-box-label">Quantity</span>
                  <span className="pp-box-value">{purchasedTicket.quantity}</span>
                </div>
                <div className="pp-detail-box">
                  <span className="pp-box-label">Price per Ticket</span>
                  <span className="pp-box-value">
                    ₹{purchasedTicket.price?.toFixed(2) || (purchasedTicket.totalAmount / purchasedTicket.quantity).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="pp-total-section">
                <div className="pp-total-row">
                  <span>Total Amount Paid</span>
                  <span className="pp-total-amount">₹{purchasedTicket.totalAmount?.toFixed(2)}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="pp-divider"></div>

              {/* Customer Info */}
              <div className="pp-customer-info">
                <div className="pp-row">
                  <span className="pp-label">👤 Name</span>
                  <span className="pp-value">{purchasedTicket.customerName || user?.name}</span>
                </div>
                <div className="pp-row">
                  <span className="pp-label">📧 Email</span>
                  <span className="pp-value">{purchasedTicket.customerEmail || user?.email}</span>
                </div>
                <div className="pp-row">
                  <span className="pp-label">📅 Purchased</span>
                  <span className="pp-value">
                    {new Date(purchasedTicket.purchaseDate || Date.now()).toLocaleString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="pp-row">
                  <span className="pp-label">✅ Status</span>
                  <span className="pp-value pp-confirmed">CONFIRMED</span>
                </div>
              </div>

              {/* Footer */}
              <div className="pp-footer">
                <p>This is a computer-generated ticket. No signature required.</p>
                <p>Transaction ID: {purchasedTicket._id}</p>
              </div>
            </div>

            <div className="pp-actions">
              <button className="pp-print-btn" onClick={handlePrintPurchasedTicket}>
                🖨️ Print / Save as PDF
              </button>
              <button className="pp-done-btn" onClick={handleClosePurchasedTicket}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketPurchase;
