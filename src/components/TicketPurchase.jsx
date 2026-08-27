import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import './TicketPurchase.css';

function TicketPurchase({ event, onBack, onSuccess }) {
  const { user, isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [dynamicPrices, setDynamicPrices] = useState({});
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    quantity: 1
  });
  const [loading, setLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(true);
  const [purchasedTicket, setPurchasedTicket] = useState(null);

  // Fetch dynamic prices for all categories
  useEffect(() => {
    const fetchDynamicPrices = async () => {
      try {
        setPriceLoading(true);
        const response = await axios.get(`${API_URL}/events/${event._id}/dynamic-prices`);
        if (response.data.prices) {
          setDynamicPrices(response.data.prices);
        }
      } catch {
        console.log('Using base prices');
        // Calculate simple dynamic pricing locally as fallback
        const occupancyRate = event.ticketsSold / event.capacity;
        let multiplier = 1 + (occupancyRate * 0.5);
        multiplier = Math.max(0.9, Math.min(2.0, multiplier));
        
        const prices = {};
        if (event.ticketCategories) {
          event.ticketCategories.forEach(cat => {
            prices[cat.name] = Math.round(cat.price * multiplier * 100) / 100;
          });
        }
        setDynamicPrices(prices);
      } finally {
        setPriceLoading(false);
      }
    };
    
    fetchDynamicPrices();
  }, [event]);

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

  // Select first category by default
  useEffect(() => {
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      setSelectedCategory(event.ticketCategories[0]);
    }
  }, [event]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    // Reset quantity if it exceeds available seats
    if (formData.quantity > category.availableSeats) {
      setFormData(prev => ({ ...prev, quantity: Math.min(prev.quantity, category.availableSeats) }));
    }
  };

  const getPrice = () => {
    if (selectedCategory) {
      // Use dynamic price if available, otherwise use base price
      return dynamicPrices[selectedCategory.name] || selectedCategory.price;
    }
    return event.currentPrice || event.basePrice || 0;
  };

  const getAvailableTickets = () => {
    if (selectedCategory) {
      return selectedCategory.availableSeats;
    }
    return event.availableTickets || (event.capacity - event.ticketsSold) || 0;
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
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/tickets`,
        {
          eventId: event._id,
          categoryId: selectedCategory?._id,
          categoryName: selectedCategory?.name,
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
        eventStartDate: event.startDate,
        eventEndDate: event.endDate,
        categoryName: selectedCategory?.name || 'standard',
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

  const hasCategories = event.ticketCategories && event.ticketCategories.length > 0;

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
            📅 {event.startDate && event.endDate
              ? `${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} to ${new Date(event.endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
              : event.startDate
                ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : event.endDate
                  ? new Date(event.endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Date not set'}
          </p>
          <p className="category-tag">🎭 {event.category}</p>
        </div>

        <div className="purchase-form-section">
          {/* Ticket Categories Section */}
          {hasCategories && (
            <div className="ticket-categories">
              <h3>🎟️ Select Ticket Type</h3>
              <div className="categories-grid">
                {event.ticketCategories.map((category) => {
                  const getCategoryDisplay = (name) => {
                    const lower = name?.toLowerCase();
                    if (lower === 'vip') return '👑 VIP';
                    if (lower === 'premium') return '⭐ Premium';
                    if (lower === 'balcony') return '🎭 Balcony';
                    if (lower === 'gold') return '🥇 Gold';
                    if (lower === 'silver') return '🥈 Silver';
                    if (lower === 'platinum') return '💎 Platinum';
                    if (lower === 'standard') return '🎫 Standard';
                    // Capitalize first letter for any other category
                    return `🎫 ${name?.charAt(0).toUpperCase() + name?.slice(1) || 'Standard'}`;
                  };
                  
                  return (
                  <div
                    key={category._id || category.name}
                    className={`category-card ${selectedCategory?.name === category.name ? 'selected' : ''} ${category.availableSeats === 0 ? 'sold-out' : ''}`}
                    onClick={() => category.availableSeats > 0 && handleCategorySelect(category)}
                  >
                    <div className="category-header">
                      <span className="category-name">
                        {getCategoryDisplay(category.name)}
                      </span>
                      {selectedCategory?.name === category.name && (
                        <span className="selected-badge">✓</span>
                      )}
                    </div>
                    <div className="category-price">
                      {priceLoading ? (
                        <span className="price-loading">Loading...</span>
                      ) : (
                        <>
                          <span className="dynamic-price">₹{(dynamicPrices[category.name] || category.price).toFixed(0)}</span>
                          {dynamicPrices[category.name] && dynamicPrices[category.name] !== category.price && (
                            <span className="base-price-strike">₹{category.price}</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="category-seats">
                      {category.availableSeats > 0 ? (
                        <span className="available">{category.availableSeats} seats left</span>
                      ) : (
                        <span className="sold-out-text">Sold Out</span>
                      )}
                    </div>
                    <div className="category-total">
                      Total: {category.seats} seats
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Single Price Display (if no categories) */}
          {!hasCategories && (
            <div className="single-price-display">
              <h3>🎟️ Ticket Price</h3>
              <div className="price-box">
                <span className="price-amount">₹{getPrice().toFixed(2)}</span>
                <span className="available-text">{getAvailableTickets()} tickets available</span>
              </div>
            </div>
          )}

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
              {selectedCategory && (
                <div className="summary-row">
                  <span>Ticket Type:</span>
                  <span className="category-label">{selectedCategory.name.toUpperCase()}</span>
                </div>
              )}
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
                  {purchasedTicket.eventStartDate && (
                    <div className="pp-row">
                      <span className="pp-label">📅 Date</span>
                      <span className="pp-value">
                        {new Date(purchasedTicket.eventStartDate).toLocaleDateString('en-US', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                        {purchasedTicket.eventEndDate && purchasedTicket.eventEndDate !== purchasedTicket.eventStartDate &&
                          ` — ${new Date(purchasedTicket.eventEndDate).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          })}`}
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
                  <span className="pp-box-value">
                    {purchasedTicket.categoryName?.toUpperCase() || 'STANDARD'}
                  </span>
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
