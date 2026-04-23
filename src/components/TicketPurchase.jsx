import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import VenueMap from './VenueMap';
import SeatGrid from './SeatGrid';
import { useBehavioral } from '../context/BehavioralContext';
import { solveTemporalPuzzle } from '../utils/temporalAuth';
import { logPricingDecision } from '../utils/pricingAudit';

function TicketPurchase({ event, onBack, onSuccess }) {
  const { user, isAuthenticated } = useAuth();
  const { generateHumanityProof, score } = useBehavioral();
  const [verifyingHumanity, setVerifyingHumanity] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(event.ticketCategories?.[0] || null);
  const [dynamicPrices, setDynamicPrices] = useState({});
  const [formData, setFormData] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    quantity: 1,
    username_real: '' // 🍯 Honeypot field
  });
  const [loading, setLoading] = useState(false);
  const [purchasedTicket, setPurchasedTicket] = useState(null);
  const [paymentMethod, setPaymentMethod]     = useState('card');
  const [userWallet, setUserWallet]           = useState({ balance: 0 });
  const [selectedSeats, setSelectedSeats]     = useState([]);

  const isSeatSelectionMode = !!selectedCategory; // Active for any category selection

  // Fetch dynamic prices for all categories
  useEffect(() => {
    const fetchDynamicPrices = async () => {
      try {
        // Include the Cognitive Score in the pricing request
        const response = await api.get(`/events/${event._id}/dynamic-prices?cognitive_score=${score}`);
        if (response.data.prices) {
          setDynamicPrices(response.data.prices);
        }
      } catch {
        console.log('Using base prices fallback');
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
      }
    };
    
    fetchDynamicPrices();
  }, [event, score]);

  async function fetchUserWallet() {
    try {
      const { data } = await api.get('/wallet/balance');
      setUserWallet(data);
    } catch (err) { console.error('Checkout wallet error:', err); }
  }

  // Pre-fill user data if logged in
  useEffect(() => {
    const userTimer = setTimeout(() => {
      if (user) {
        setFormData(prev => ({
          ...prev,
          customerName: user.name || '',
          customerEmail: user.email || ''
        }));
        fetchUserWallet();
      }
    }, 0);
    return () => clearTimeout(userTimer);
  }, [user]);

  // Select first category by default
  useEffect(() => {
    const categoryTimer = setTimeout(() => {
      if (event.ticketCategories && event.ticketCategories.length > 0) {
        setSelectedCategory(event.ticketCategories[0]);
      }
    }, 0);
    return () => clearTimeout(categoryTimer);
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
    setSelectedSeats([]); // reset seats on category change
    // Reset quantity if it exceeds available seats
    if (formData.quantity > category.availableSeats) {
      setFormData(prev => ({ ...prev, quantity: Math.min(prev.quantity, category.availableSeats) }));
    }
  };

  const handleToggleSeat = (seatId) => {
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) return prev.filter(s => s !== seatId);
      if (prev.length >= 15) {
        alert('You can select a maximum of 15 seats per purchase.');
        return prev;
      }
      return [...prev, seatId];
    });
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

  const getPurchaseQuantity = () => {
    return isSeatSelectionMode ? selectedSeats.length : parseInt(formData.quantity);
  };

  const calculateTotal = () => {
    return getPrice() * getPurchaseQuantity();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return; // Prevent double submission

    if (!isAuthenticated) {
      alert('Please login to purchase tickets');
      return;
    }

    const currentQty = getPurchaseQuantity();

    if (isSeatSelectionMode && currentQty === 0) {
      alert('Please select at least one seat from the map.');
      return;
    }

    const available = getAvailableTickets();
    if (currentQty > 15) {
      alert('You can purchase a maximum of 15 tickets per event.');
      return;
    }
    if (currentQty > available) {
      alert(`Only ${available} tickets available!`);
      return;
    }

    setLoading(true);
    setVerifyingHumanity(true);

    try {
      // 0. Fetch Security Nonce (Anti-Replay)
      const nonceRes = await api.get('/security/nonce');
      const { nonce, sessionId } = nonceRes.data;

      // 1. Edge-AI Humanity Check (Context-Locked Cognitive Gate)
      const humanitySignature = await generateHumanityProof(nonce);
      if (!humanitySignature) {
        throw new Error('Inhuman behavior detected or spectral density check failed.');
      }

      // 2. Temporal Speed-Bump (VDF)
      const proof = await solveTemporalPuzzle(humanitySignature);
      setVerifyingHumanity(false);

      // 3. Pricing Audit Log (Blockchain Transparency)
      await logPricingDecision({
        eventId: event._id,
        price: getPrice(),
        qty: currentQty,
        humanitySignature,
        sessionId
      });

      const response = await api.post(
        '/tickets',
        {
          eventId: event._id,
          categoryId: selectedCategory?._id,
          categoryName: selectedCategory?.name,
          ...formData,
          quantity: currentQty,
          selectedSeats: isSeatSelectionMode ? selectedSeats : [],
          pricePerTicket: getPrice(),
          cognitive_score: score,
          sessionId,
          humanityProof: humanitySignature,
          temporalProof: proof.proof // Send the actual VDF result
        }
      );

      // Create Payment Record
      try {
        await api.post(
          '/payments',
          {
            ticketId: response.data.tickets[0]._id, // Lead ticket
            bookingReference: response.data.tickets[0].bookingReference,
            amount: response.data.tickets.reduce((sum, t) => sum + t.totalAmount, 0),
            paymentMethod: paymentMethod, 
            metadata: {
              ticketIds: response.data.tickets.map(t => t._id),
              eventTitle: event.name
            }
          }
        );
      } catch (payErr) {
        console.error('Payment recording failed:', payErr);
        // We continue anyway as the tickets were already created
      }

      setLoading(false);
      setPurchasedTicket({
        tickets: response.data.tickets,
        _id: response.data.tickets[0]._id,
        bookingReference: response.data.tickets[0].bookingReference,
        totalAmount: response.data.tickets.reduce((sum, t) => sum + t.totalAmount, 0),
        quantity: response.data.tickets.length,
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
      setVerifyingHumanity(false);
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
    <div className="cyber-container animate-fade-up" style={{ padding: '2rem 0' }}>
      <button className="cyber-btn btn-outline" onClick={onBack} style={{ marginBottom: '2rem' }}>
        ← Back to Events
      </button>

      <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1.5fr', gap: '3rem', alignItems: 'start' }}>
        {/* Left Column: Event Details */}
        <div className="cyber-card flex-column" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ height: '300px', backgroundImage: `url(${event.image || '/default-event.png'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
          <div style={{ padding: '2rem' }}>
            <h2 className="title-main text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>{event.name}</h2>
            <div className="flex-column" style={{ gap: '1rem' }}>
              <p className="text-main" style={{ fontSize: '1.1rem' }}>📍 {event.venue}</p>
              <p className="text-muted">
                📅 {event.startDate && event.endDate
                  ? `${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}`
                  : event.startDate
                    ? new Date(event.startDate).toLocaleDateString()
                    : 'Date not set'}
              </p>
              <div className="cyber-badge badge-info" style={{ width: 'fit-content' }}>🎭 {event.category}</div>
            </div>

            <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
              <h4 className="cyber-label" style={{ marginBottom: '1rem' }}>📋 Order Summary</h4>
              <div className="flex-column" style={{ gap: '0.8rem' }}>
                {selectedCategory && (
                  <div className="flex-between">
                    <span className="text-muted">Type:</span>
                    <span className="text-main" style={{ fontWeight: '700' }}>{selectedCategory.name.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-between">
                  <span className="text-muted">Price:</span>
                  <span className="text-main">₹{getPrice().toFixed(2)}</span>
                </div>
                <div className="flex-between">
                  <span className="text-muted">Quantity:</span>
                  <span className="text-main">× {getPurchaseQuantity()}</span>
                </div>
                <div style={{ height: '1px', background: 'var(--border-dim)', margin: '0.5rem 0' }}></div>
                <div className="flex-between">
                  <span className="text-glow" style={{ fontSize: '1.1rem', fontWeight: '800' }}>Total:</span>
                  <span className="text-glow" style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--accent-cyan)' }}>
                    ₹{calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Selection & Form */}
        <div className="flex-column" style={{ gap: '2rem' }}>
          
          {/* Venue & Seat Selection */}
          <div className="cyber-card">
            <h3 className="title-sub" style={{ fontSize: '1.4rem' }}>🗺️ Select Your Experience</h3>
            
            {event.venueLayoutType && event.venueLayoutType !== 'none' && hasCategories && (
              <div style={{ marginBottom: '2rem' }}>
                <VenueMap
                  layoutType={event.venueLayoutType}
                  stagePosition={event.stagePosition || 'bottom'}
                  categories={event.ticketCategories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={handleCategorySelect}
                  dynamicPrices={dynamicPrices}
                  showPrices={true}
                  interactive={true}
                />
              </div>
            )}

            {isSeatSelectionMode && (
              <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '2rem' }}>
                <SeatGrid
                  category={selectedCategory}
                  selectedSeats={selectedSeats}
                  onToggleSeat={handleToggleSeat}
                  interactive={true}
                  seatMap={event.seatMap}
                  totalCapacity={event.capacity}
                />
              </div>
            )}
          </div>

          {/* Categories Grid */}
          {hasCategories && (
            <div className="cyber-card">
              <h3 className="cyber-label" style={{ marginBottom: '1.5rem' }}>Select Tier</h3>
              <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {event.ticketCategories.map((category) => (
                  <div
                    key={category._id || category.name}
                    className={`cyber-card flex-column flex-center ${selectedCategory?.name === category.name ? 'selected' : ''}`}
                    style={{ 
                      padding: '1.25rem', 
                      cursor: 'pointer',
                      background: selectedCategory?.name === category.name ? 'rgba(102, 126, 234, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                      borderColor: selectedCategory?.name === category.name ? 'var(--accent-indigo)' : 'var(--border-dim)',
                      opacity: category.availableSeats === 0 ? 0.5 : 1
                    }}
                    onClick={() => category.availableSeats > 0 && handleCategorySelect(category)}
                  >
                    <span className="text-main" style={{ fontWeight: '800', marginBottom: '0.5rem' }}>{category.name.toUpperCase()}</span>
                    <div className="flex-column flex-center">
                      <span className="text-glow" style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-cyan)' }}>
                        ₹{(dynamicPrices[category.name] || category.price).toFixed(0)}
                      </span>
                      {dynamicPrices[category.name] && dynamicPrices[category.name] !== category.price && (
                        <span className="text-dim" style={{ textDecoration: 'line-through', fontSize: '0.8rem' }}>₹{category.price}</span>
                      )}
                    </div>
                    <span className={`cyber-badge ${category.availableSeats > 0 ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: '1rem', fontSize: '0.65rem' }}>
                      {category.availableSeats > 0 ? `${category.availableSeats} LEFT` : 'SOLD OUT'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checkout Form */}
          <div className="cyber-card">
            <h3 className="title-sub" style={{ fontSize: '1.4rem' }}>💳 Finalize Booking</h3>
            <form onSubmit={handleSubmit} className="flex-column" style={{ gap: '1.5rem' }}>
              <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="cyber-form-group">
                  <label className="cyber-label">Name</label>
                  <input className="cyber-input" type="text" value={formData.customerName} readOnly />
                </div>
                <div className="cyber-form-group">
                  <label className="cyber-label">Email</label>
                  <input className="cyber-input" type="email" value={formData.customerEmail} readOnly />
                </div>
              </div>

              {!isSeatSelectionMode && (
                <div className="cyber-form-group">
                  <label className="cyber-label">Quantity</label>
                  <input
                    className="cyber-input"
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    min="1"
                    max={Math.min(15, getAvailableTickets())}
                  />
                </div>
              )}

              <div className="flex-column" style={{ gap: '1rem' }}>
                <label className="cyber-label">Payment Method</label>
                <div className="flex-center" style={{ gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                  {[
                    { id: 'card', icon: '💳' },
                    { id: 'upi', icon: '📱' },
                    { id: 'wallet', icon: '💰' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      className={`cyber-btn ${paymentMethod === method.id ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '0.8rem 1.2rem' }}
                      onClick={() => setPaymentMethod(method.id)}
                    >
                      {method.icon} {method.id.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'wallet' && isAuthenticated && (
                <div className="glass-panel flex-between" style={{ padding: '1rem', borderLeft: `4px solid ${userWallet.balance < calculateTotal() ? 'var(--danger)' : 'var(--success)'}` }}>
                  <span className="text-main">Wallet Balance: ₹{userWallet.balance.toFixed(2)}</span>
                  {userWallet.balance < calculateTotal() && <span className="cyber-badge badge-danger">Insufficient Funds</span>}
                </div>
              )}

              <button 
                type="submit" 
                className="cyber-btn btn-glow" 
                style={{ padding: '1.25rem', fontSize: '1.1rem' }}
                disabled={loading || getAvailableTickets() === 0 || !isAuthenticated || (paymentMethod === 'wallet' && userWallet.balance < calculateTotal())}
              >
                {loading ? 'PROCESSING...' : 
                 !isAuthenticated ? 'LOGIN TO PURCHASE' :
                 getAvailableTickets() === 0 ? 'SOLD OUT' :
                 `CONFIRM & PAY ₹${calculateTotal().toFixed(2)}`}
              </button>
            </form>
          </div>
        </div>
      </div>
      
      {/* DECPG Verification Overlay */}
      {verifyingHumanity && (
        <div className="flex-center" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, backdropFilter: 'blur(10px)' }}>
          <div className="flex-column flex-center cyber-card animate-pulse" style={{ padding: '2rem', border: '2px solid var(--accent-cyan)' }}>
            <div className="spinner" style={{ width: '60px', height: '60px', marginBottom: '2rem', borderTopColor: 'var(--accent-cyan)' }}></div>
            <h2 className="title-sub text-gradient" style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>🛡️ Verifying Humanity</h2>
            <p className="text-main" style={{ textAlign: 'center', maxWidth: '300px' }}>
              Our Edge-Cognitive AI is analyzing your behavioral signature to neutralize bots...
            </p>
            <div className="text-dim" style={{ marginTop: '2rem', fontSize: '0.8rem' }}>
              Solving Non-Parallelizable Temporal Puzzle (VDF)
            </div>
          </div>
        </div>
      )}

      {/* Ticket Modal Overlay */}
      {purchasedTicket && (
        <div className="flex-center" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, padding: '2rem' }}>
          <div className="cyber-card animate-fade-up" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div id="printable-purchase-ticket" style={{ padding: '1rem' }}>
               <h2 className="text-gradient title-main" style={{ fontSize: '2rem', textAlign: 'center' }}>Ticket Confirmed!</h2>
               <div className="cyber-badge badge-success flex-center" style={{ margin: '0 auto 2rem', width: 'fit-content' }}>✅ PAYMENT SUCCESSFUL</div>
               
               <div className="cyber-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                 <p className="text-main" style={{ fontWeight: '800', fontSize: '1.2rem' }}>{purchasedTicket.eventName}</p>
                 <p className="text-dim">📍 {purchasedTicket.eventVenue}</p>
                 <p className="text-muted">📅 {new Date(purchasedTicket.eventStartDate).toLocaleString()}</p>
                 <div style={{ height: '1px', background: 'var(--border-dim)', margin: '1rem 0' }}></div>
                 <div className="flex-between">
                   <span className="cyber-label">Booking Ref</span>
                   <span className="text-main" style={{ fontWeight: '900', color: 'var(--accent-cyan)' }}>{purchasedTicket.bookingReference}</span>
                 </div>
               </div>

               <div className="flex-column" style={{ gap: '1rem' }}>
                 {purchasedTicket.tickets?.map((t, i) => (
                   <div key={t._id} className="glass-panel flex-between" style={{ padding: '1rem' }}>
                     <div>
                       <span className="cyber-label" style={{ fontSize: '0.6rem' }}>TICKET {i + 1}</span>
                       <p className="text-main" style={{ fontWeight: '700' }}>{purchasedTicket.categoryName?.toUpperCase()}</p>
                     </div>
                     {t.qrCode ? <img src={t.qrCode} alt="QR" style={{ width: '60px', height: '60px', background: 'white', padding: '4px', borderRadius: '4px' }} /> : <span className="text-dim">Generating...</span>}
                   </div>
                 ))}
               </div>
            </div>

            <div className="flex-center" style={{ gap: '1rem', marginTop: '2rem' }}>
              <button className="cyber-btn btn-primary" onClick={handlePrintPurchasedTicket}>🖨️ PRINT PDF</button>
              <button className="cyber-btn btn-outline" onClick={handleClosePurchasedTicket}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketPurchase;
