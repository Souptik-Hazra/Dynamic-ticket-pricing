import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { ENDPOINTS } from '../config/api';
import { useAuth } from '../context/AuthContext';
import VenueMap from './VenueMap';
import SeatGrid from './SeatGrid';
import { useBehavioral } from '../context/BehavioralContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { solveTemporalPuzzle } from '../utils/temporalAuth';
import { logPricingDecision } from '../utils/pricingAudit';

function TicketPurchase({ event, onBack, onSuccess }) {
  const { user, isAuthenticated } = useAuth();
  const { generateHumanityProof, score } = useBehavioral();
  const { connected, lastEvent, throttle } = useWebSocket();
  const [verifyingHumanity, setVerifyingHumanity] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(event?.ticketCategories?.[0] || null);
  const [dynamicPrices, setDynamicPrices] = useState({});
  const [formData, setFormData] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    quantity: 1,
    username_real: '' // 🍯 Honeypot
  });
  const [loading, setLoading] = useState(false);
  const [purchasedTicket, setPurchasedTicket] = useState(null);
  const [paymentMethod, setPaymentMethod]     = useState('card');
  const [userWallet, setUserWallet]           = useState({ balance: 0 });
  const [selectedSeats, setSelectedSeats]     = useState([]);

  const isSeatSelectionMode = !!selectedCategory; 

  // 🛰️ Stable Dynamic Pricing Engine (REST fallback/init)
  useEffect(() => {
    const fetchDynamicPrices = async () => {
      if (!event?._id) return;
      try {
        const stableScore = Math.round(score * 10) / 10;
        const response = await api.get(`${ENDPOINTS.EVENT_DYNAMIC_PRICES(event._id)}?cognitive_score=${stableScore}`);
        if (response.data.prices) setDynamicPrices(response.data.prices);
      } catch (err) {
        console.warn('Fallback to local occupancy-based pricing');
      }
    };
    fetchDynamicPrices();
  }, [event?._id]);

  // 🌩️ Real-time Price Pulse (WebSocket)
  useEffect(() => {
    if (lastEvent?.type === 'price_update' && lastEvent.eventId === event?._id) {
      console.log('💹 Real-time Price Pulse received via Neural Link');
      setDynamicPrices(lastEvent.prices);
    }
  }, [lastEvent, event?._id]);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        customerName: user.name || '',
        customerEmail: user.email || ''
      }));
      api.get('/wallet/balance').then(({ data }) => setUserWallet(data)).catch(() => null);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSelectedSeats([]); 
    if (formData.quantity > (category.availableSeats || 0)) {
      setFormData(prev => ({ ...prev, quantity: Math.min(prev.quantity, category.availableSeats || 1) }));
    }
  };

  const handleToggleSeat = (seatId) => {
    setSelectedSeats(prev => {
      if (prev.includes(seatId)) return prev.filter(s => s !== seatId);
      if (prev.length >= 15) { alert('Max 15 seats allowed.'); return prev; }
      return [...prev, seatId];
    });
  };

  const getPrice = () => {
    if (selectedCategory) return dynamicPrices[selectedCategory.name] || selectedCategory.price || 0;
    return event.currentPrice || event.basePrice || 0;
  };

  const getAvailableTickets = () => {
    if (selectedCategory) return selectedCategory.availableSeats || 0;
    return event.availableTickets || (event.capacity - event.ticketsSold) || 0;
  };

  const getPurchaseQuantity = () => isSeatSelectionMode ? selectedSeats.length : (parseInt(formData.quantity) || 1);
  const calculateTotal = () => getPrice() * getPurchaseQuantity();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !isAuthenticated) return;

    const currentQty = getPurchaseQuantity();
    if (isSeatSelectionMode && currentQty === 0) { alert('Please select seats.'); return; }

    setLoading(true);
    setVerifyingHumanity(true);

    try {
      const nonceRes = await api.get('/security/nonce');
      const { nonce, sessionId } = nonceRes.data;

      // 1. Edge-AI Proof Generation
      const humanityResult = await generateHumanityProof(nonce);
      if (!humanityResult) throw new Error('Humanity verification failed.');
      const { signature: humanitySignature, telemetry: behavioralMetadata } = humanityResult;

      // 2. Temporal Puzzle
      const proof = await solveTemporalPuzzle(humanitySignature);
      setVerifyingHumanity(false);

      // 3. Audit Logging
      await logPricingDecision({ eventId: event._id, price: getPrice(), qty: currentQty, humanitySignature, sessionId });

      const response = await api.post('/tickets', {
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
        behavioralMetadata,
        temporalProof: proof.proof
      });

      // 4. Record Payment
      try {
        await api.post('/payments', {
          ticketId: response.data.tickets[0]._id,
          bookingReference: response.data.tickets[0].bookingReference,
          amount: response.data.tickets.reduce((sum, t) => sum + t.totalAmount, 0),
          paymentMethod,
          metadata: { ticketIds: response.data.tickets.map(t => t._id), eventTitle: event.name }
        });
      } catch (payErr) { console.error('Payment log failed'); }

      setLoading(false);
      setPurchasedTicket({
        tickets: response.data.tickets,
        _id: response.data.tickets[0]._id,
        bookingReference: response.data.tickets[0].bookingReference,
        totalAmount: response.data.tickets.reduce((sum, t) => sum + t.totalAmount, 0),
        quantity: response.data.tickets.length,
        eventName: event.name,
        eventVenue: event.venue,
        eventStartDate: event.startDate,
        categoryName: selectedCategory?.name || 'standard',
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
      });
    } catch (error) {
      setLoading(false);
      setVerifyingHumanity(false);
      alert(`❌ ${error.response?.data?.message || error.message || 'Purchase failed'}`);
    }
  };

  const hasCategories = event?.ticketCategories && event.ticketCategories.length > 0;

  if (!event) return null;

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '2rem 0' }}>
      <div className="flex-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button className="cyber-btn btn-outline" onClick={onBack}>← Back to Events</button>
        
        {/* 🛡️ WebSocket Sentinel Status */}
        <div className="flex-center" style={{ gap: '1rem' }}>
          <div className="glass-panel flex-center" style={{ padding: '0.4rem 1rem', borderRadius: '30px', border: `1px solid ${connected ? 'var(--success)' : 'var(--danger)'}` }}>
            <div className={`status-dot ${connected ? 'online' : 'offline'}`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--danger)', marginRight: '8px', boxShadow: connected ? '0 0 10px var(--success)' : 'none' }}></div>
            <span className="cyber-label" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>
              {connected ? 'NEURAL LINK ACTIVE' : 'LINK DISCONNECTED'}
            </span>
          </div>
          {throttle > 0 && (
            <div className="glass-panel flex-center animate-pulse" style={{ padding: '0.4rem 1rem', borderRadius: '30px', border: '1px solid var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
              <span className="cyber-label" style={{ fontSize: '0.65rem', color: 'var(--warning)' }}>⚠️ THROTLED: {throttle}ms</span>
            </div>
          )}
        </div>
      </div>

      <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1.5fr', gap: '3rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: EVENT DETAILS & SUMMARY */}
        <div className="flex-column" style={{ gap: '2rem' }}>
          <div className="cyber-card flex-column" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ height: '300px', backgroundImage: `url(${event.image || '/default-event.png'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            <div style={{ padding: '2rem' }}>
              <h2 className="title-main text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>{event.name}</h2>
              <div className="flex-column" style={{ gap: '1rem' }}>
                <p className="text-main" style={{ fontSize: '1.1rem' }}>📍 {event.venue}</p>
                <p className="text-muted">📅 {new Date(event.startDate).toLocaleDateString()}</p>
                <div className="cyber-badge badge-info" style={{ width: 'fit-content' }}>🎭 {event.category}</div>
              </div>

              <div className="glass-panel" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
                <h4 className="cyber-label" style={{ marginBottom: '1rem' }}>📋 Order Summary</h4>
                <div className="flex-column" style={{ gap: '0.8rem' }}>
                  {selectedCategory && (
                    <div className="flex-between">
                      <span className="text-muted">Tier:</span>
                      <span className="text-main" style={{ fontWeight: '800' }}>{selectedCategory.name.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-between">
                    <span className="text-muted">Price:</span>
                    <span className="text-main">₹{(getPrice() || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex-between">
                    <span className="text-muted">Qty:</span>
                    <span className="text-main">× {getPurchaseQuantity()}</span>
                  </div>
                  <div style={{ height: '1px', background: 'var(--border-dim)', margin: '0.5rem 0' }}></div>
                  <div className="flex-between">
                    <span className="text-glow" style={{ fontSize: '1.1rem', fontWeight: '800' }}>Total:</span>
                    <span className="text-glow" style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--accent-cyan)' }}>
                      ₹{(calculateTotal() || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE SELECTION */}
        <div className="flex-column" style={{ gap: '2rem' }}>
          
          {/* VENUE MAP */}
          <div className="cyber-card">
            <h3 className="title-sub" style={{ fontSize: '1.4rem' }}>🗺️ Select Experience</h3>
            {(event.venueLayoutType && event.venueLayoutType !== 'none') && (
              <VenueMap 
                layoutType={event.venueLayoutType} 
                stagePosition={event.stagePosition || 'bottom'}
                categories={event.ticketCategories || []} 
                selectedCategory={selectedCategory} 
                onSelectCategory={handleCategorySelect} 
                dynamicPrices={dynamicPrices} 
                showPrices={true} 
                interactive={true} 
              />
            )}
            {isSeatSelectionMode && (
              <div style={{ borderTop: '1px solid var(--border-dim)', marginTop: '2rem', paddingTop: '2rem' }}>
                <SeatGrid 
                  category={selectedCategory} 
                  categories={event.ticketCategories || []}
                  selectedSeats={selectedSeats} 
                  onToggleSeat={handleToggleSeat} 
                  interactive={true} 
                  seatMap={event.seatMap || []} 
                  totalCapacity={event.capacity || 0} 
                />
              </div>
            )}
          </div>

          {/* 💎 CATEGORIES GRID (TIER SELECTOR) */}
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
                      opacity: (category.availableSeats || 0) === 0 ? 0.5 : 1,
                      borderWidth: '2px'
                    }}
                    onClick={() => (category.availableSeats || 0) > 0 && handleCategorySelect(category)}
                  >
                    <span className="text-main" style={{ fontWeight: '800', marginBottom: '0.5rem' }}>{category.name.toUpperCase()}</span>
                    <div className="flex-column flex-center">
                      <span className="text-glow" style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-cyan)' }}>
                        ₹{(dynamicPrices[category.name] || category.price || 0).toFixed(0)}
                      </span>
                      {(dynamicPrices[category.name] && dynamicPrices[category.name] !== category.price) && (
                        <span className="text-dim" style={{ textDecoration: 'line-through', fontSize: '0.8rem' }}>₹{category.price}</span>
                      )}
                    </div>
                    <span className={`cyber-badge ${(category.availableSeats || 0) > 0 ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: '1rem', fontSize: '0.65rem' }}>
                      {(category.availableSeats || 0) > 0 ? `${category.availableSeats} LEFT` : 'SOLD OUT'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHECKOUT FORM */}
          <div className="cyber-card">
            <h3 className="title-sub" style={{ fontSize: '1.4rem' }}>💳 Finalize Booking</h3>
            <form onSubmit={handleSubmit} className="flex-column" style={{ gap: '1.5rem' }}>
              {/* 🍯 Federated Bot Trap */}
              <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
                <input type="text" name="username_real" value={formData.username_real} onChange={handleChange} tabIndex="-1" autoComplete="off" />
                <button type="button" onClick={() => setFormData(p => ({ ...p, username_real: 'BOT_TRAP_CLICKED' }))} tabIndex="-1">Confirm</button>
              </div>

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
                  <input className="cyber-input" type="number" name="quantity" value={formData.quantity} onChange={handleChange} min="1" max={Math.min(15, getAvailableTickets())} />
                </div>
              )}

              <div className="flex-column" style={{ gap: '1rem' }}>
                <label className="cyber-label">Payment Method</label>
                <div className="flex-center" style={{ gap: '1rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                  {['card', 'upi', 'wallet'].map(m => (
                    <button key={m} type="button" className={`cyber-btn ${paymentMethod === m ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPaymentMethod(m)} style={{ padding: '0.8rem 1.5rem' }}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'wallet' && (
                <div className="glass-panel flex-between" style={{ padding: '1rem', borderLeft: `4px solid ${userWallet.balance < calculateTotal() ? 'var(--danger)' : 'var(--success)'}` }}>
                  <span className="text-main">Balance: ₹{userWallet.balance.toFixed(2)}</span>
                  {userWallet.balance < calculateTotal() && <span className="cyber-badge badge-danger">Low Balance</span>}
                </div>
              )}

              <button 
                type="submit" 
                className="cyber-btn btn-glow" 
                style={{ padding: '1.25rem', fontSize: '1.1rem' }}
                disabled={loading || getAvailableTickets() === 0 || !isAuthenticated || (paymentMethod === 'wallet' && userWallet.balance < calculateTotal())}
              >
                {loading ? 'PROCESSING...' : `CONFIRM & PAY ₹${(calculateTotal() || 0).toFixed(2)}`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 🛡️ VERIFICATION OVERLAY */}
      {verifyingHumanity && (
        <div className="flex-center" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, backdropFilter: 'blur(10px)' }}>
          <div className="flex-column flex-center cyber-card animate-pulse" style={{ padding: '2rem', border: '2px solid var(--accent-cyan)', maxWidth: '400px' }}>
            <div className="spinner" style={{ width: '60px', height: '60px', marginBottom: '2rem' }}></div>
            <h2 className="title-sub text-gradient" style={{ textAlign: 'center' }}>🛡️ Verifying Humanity</h2>
            <p className="text-main" style={{ textAlign: 'center' }}>Analyzing behavior and solving temporal puzzles...</p>
          </div>
        </div>
      )}

      {/* 🎫 SUCCESS MODAL (FULL RESTORATION) */}
      {purchasedTicket && (
        <div className="flex-center" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, padding: '2rem' }}>
          <div className="cyber-card animate-fade-up" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem' }}>
            <h2 className="text-gradient title-main" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Booking Confirmed!</h2>
            
            <div className="cyber-card" style={{ padding: '1.5rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-main" style={{ fontWeight: '900', fontSize: '1.3rem' }}>{purchasedTicket.eventName}</p>
              <p className="text-dim">📍 {purchasedTicket.eventVenue}</p>
              <div className="flex-between" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-dim)', paddingTop: '1rem' }}>
                <span className="cyber-label">Booking Reference</span>
                <span className="text-glow" style={{ fontWeight: '900', color: 'var(--accent-cyan)' }}>{purchasedTicket.bookingReference}</span>
              </div>
            </div>

            <div className="flex-column" style={{ gap: '1rem', marginBottom: '2rem' }}>
              {purchasedTicket.tickets?.map((t, i) => (
                <div key={t._id} className="glass-panel flex-between" style={{ padding: '1.25rem' }}>
                  <div className="flex-column">
                    <span className="cyber-label" style={{ fontSize: '0.6rem', opacity: 0.5 }}>TICKET {i + 1}</span>
                    <span className="text-main" style={{ fontWeight: '800' }}>{purchasedTicket.categoryName?.toUpperCase()}</span>
                    {t.seatNumber && <span className="text-accent" style={{ fontSize: '0.8rem' }}>Seat: {t.seatNumber}</span>}
                  </div>
                  {t.qrCode ? (
                    <img src={t.qrCode} alt="QR" style={{ width: '70px', height: '70px', background: '#fff', padding: '5px', borderRadius: '4px' }} />
                  ) : (
                    <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex-center" style={{ gap: '1.5rem' }}>
              <button className="cyber-btn btn-primary" style={{ flex: 1 }} onClick={() => window.print()}>🖨️ PRINT PDF</button>
              <button className="cyber-btn btn-outline" style={{ flex: 1 }} onClick={() => { setPurchasedTicket(null); onSuccess(); }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketPurchase;
