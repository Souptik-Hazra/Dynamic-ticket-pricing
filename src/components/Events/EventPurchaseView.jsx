import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateTemporalProof } from '../../utils/humanity';

/**
 * 💎 Diamond Event Purchase View (Phase 10)
 * 
 * The ultimate high-stakes user experience:
 * - WebSocket-driven live price pulsing.
 * - Real-time inventory urgency.
 * - Integrated "Proof-of-Humanity" purchase shield.
 */

const EventPurchaseView = ({ event, onPurchase }) => {
  const [prices, setPrices] = useState(event.prices || { standard: 1000 });
  const [inventory, setInventory] = useState(event.availableTickets || 100);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [pulseColor, setPulseColor] = useState('transparent');

  // 📡 WebSocket Integration (Simulated for this demo)
  useEffect(() => {
    const wsInterval = setInterval(() => {
      // Simulate a price update from the AI
      const change = Math.random() > 0.5 ? 50 : -50;
      setPrices(prev => ({ standard: prev.standard + change }));
      setPulseColor(change > 0 ? 'rgba(255, 82, 82, 0.3)' : 'rgba(0, 230, 118, 0.3)');
      
      // Reset pulse color after animation
      setTimeout(() => setPulseColor('transparent'), 1000);
      
      // Simulate inventory drop
      if (inventory > 5) setInventory(prev => prev - 1);
    }, 8000);

    return () => clearInterval(wsInterval);
  }, [inventory]);

  const handleSecurePurchase = async () => {
    setIsPurchasing(true);
    
    // 🛡️ Diamond Step: Solve Proof-of-Humanity Challenge
    const { challenge, proof } = await generateTemporalProof(event._id);
    
    // Call the purchase logic
    await onPurchase({ 
      eventId: event._id, 
      price: prices.standard,
      temporalProof: proof,
      challenge: challenge
    });
    
    setIsPurchasing(false);
  };

  const inventoryPercent = (inventory / event.capacity) * 100;

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '2rem 0' }}>
      <div className="cyber-grid" style={{ gridTemplateColumns: '2fr 1.2fr' }}>
        
        {/* 🎫 EVENT INFO & SELECTION */}
        <div className="cyber-card">
          <div className="flex-between">
            <h1 className="title-main" style={{ fontSize: '2.5rem' }}>{event.name}</h1>
            <div className="cyber-badge badge-info">LIVE MARKET</div>
          </div>
          <p className="text-muted" style={{ margin: '1rem 0' }}>{event.venue} | {new Date(event.startDate).toLocaleDateString()}</p>
          
          <div className="glass-panel" style={{ marginTop: '2rem', padding: '2rem' }}>
            <h3 className="cyber-label">Select Category</h3>
            <div className="cyber-grid" style={{ marginTop: '1rem' }}>
              <motion.div 
                className="cyber-card" 
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid var(--accent-cyan)',
                  backgroundColor: pulseColor,
                  transition: 'background-color 1s ease'
                }}
              >
                <div className="flex-between">
                  <span style={{ fontWeight: 'bold' }}>Standard Access</span>
                  <motion.span 
                    key={prices.standard}
                    initial={{ scale: 1.2, color: 'var(--accent-cyan)' }}
                    animate={{ scale: 1, color: 'var(--text-main)' }}
                    style={{ fontSize: '1.5rem', fontWeight: 900 }}
                  >
                    ₹{prices.standard}
                  </motion.span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* 🛒 CHECKOUT & URGENCY */}
        <div className="flex-column" style={{ gap: '1.5rem' }}>
          
          {/* URGENCY CARD */}
          <div className="cyber-card" style={{ background: 'rgba(5, 9, 20, 0.9)' }}>
            <div className="cyber-label">Tickets Remaining</div>
            <div className="flex-between" style={{ margin: '0.5rem 0' }}>
              <span className="title-main" style={{ fontSize: '1.8rem', margin: 0 }}>{inventory}</span>
              <span className="text-muted">of {event.capacity}</span>
            </div>
            
            {/* Inventory Progress Bar */}
            <div style={{ height: '6px', background: 'var(--bg-accent)', borderRadius: '3px', overflow: 'hidden' }}>
              <motion.div 
                animate={{ 
                  width: `${inventoryPercent}%`,
                  backgroundColor: inventoryPercent < 15 ? 'var(--danger)' : 'var(--accent-cyan)' 
                }}
                style={{ height: '100%' }}
              />
            </div>
            {inventoryPercent < 15 && (
              <div className="cyber-pulse" style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 'bold' }}>
                🚨 SELLING FAST - ONLY A FEW LEFT!
              </div>
            )}
          </div>

          {/* SECURE PURCHASE BUTTON */}
          <button 
            className={`cyber-btn btn-primary ${isPurchasing ? 'cyber-pulse' : ''}`}
            disabled={isPurchasing}
            onClick={handleSecurePurchase}
            style={{ height: '60px', fontSize: '1.1rem', boxShadow: 'var(--diamond-glow)' }}
          >
            {isPurchasing ? (
              <>
                <span className="flex-center" style={{ gap: '0.5rem' }}>
                  <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid white', borderRadius: '50%', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                  VERIFYING HUMANITY...
                </span>
              </>
            ) : (
              'SECURE TICKETS NOW'
            )}
          </button>
          
          <div className="text-center" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            🛡️ Protected by Diamond Anti-Scalper Shield
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default EventPurchaseView;
