import React, { useState } from 'react';
import VenueMap from './VenueMap';
import SeatGrid from './SeatGrid';
import { generateAutoBlockSeats } from '../utils/CrowdSimulator';
import client from '../api/client';

const LAYOUT_OPTIONS = [
  {
    type: 'none',
    label: 'No Layout',
    icon: '❌',
    desc: 'Standard list view only',
  },
  {
    type: 'stadium',
    label: 'Stadium',
    icon: '🏟️',
    desc: 'Circular/oval — Cricket, Football',
  },
  {
    type: 'theater',
    label: 'Theater',
    icon: '🎭',
    desc: 'Tiered rows — Plays, Concerts',
  },
  {
    type: 'arena',
    label: 'Arena',
    icon: '🥊',
    desc: 'U-shape — Boxing, Indoor events',
  },
  {
    type: 'rectangle',
    label: 'Hall',
    icon: '🏢',
    desc: 'Grid blocks — Conferences',
  },
  {
    type: 'festival',
    label: 'Festival',
    icon: '🎪',
    desc: 'Concentric zones — Open-air',
  },
  {
    type: 'premium_concert',
    label: 'Premium Concert',
    icon: '🎸',
    desc: 'Multi-tier luxe arena',
  },
];

const DEFAULT_COLORS = [
  '#FFD700', '#E040FB', '#00E5FF', '#76FF03', '#FF6D00',
  '#448AFF', '#FF1744', '#00E676', '#D500F9', '#FFEA00',
];

const COLOR_PALETTE = [
  '#FFD700', '#E040FB', '#00E5FF', '#76FF03', '#FF6D00',
  '#448AFF', '#FF1744', '#00E676', '#D500F9', '#FFEA00',
  '#FF5252', '#536DFE', '#69F0AE', '#FFD740', '#E0E0E0',
];

function VenueLayoutDesigner({
  layoutType,
  setLayoutType,
  stagePosition,
  setStagePosition,
  categories,
  onCategoryColorChange,
  onCategoryBlockedSeatsChange,
  venueMetrics = { exitsCount: 4, aisleWidth: 'standard', securitySpeed: 'normal' },
  setVenueMetrics = () => {},
  isSafetyMode = false,
  setIsSafetyMode = () => {},
  safetyScores = {},
  setSafetyScores = () => {}
  , eventName, eventId, eventPopularity,
  selectedCategory: selectedCategoryProp = null,
  onSelectCategory: onSelectCategoryProp = null,
  seatMap = []
}) {
  const [showColorPicker, setShowColorPicker]   = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isSimulating, setIsSimulating]         = useState(false);

  const { user } = { user: { role: 'admin' } }; // Mocked or get from context if needed
  const isAdmin = true; // For now

  React.useEffect(() => {
    if (selectedCategoryProp) setSelectedCategory(selectedCategoryProp);
  }, [selectedCategoryProp]);

  const toggleSafetyMode = async () => {
    if (isSafetyMode) {
      setIsSafetyMode(false);
      return;
    }

    setIsSimulating(true);
    try {
      const normalizedCats = categories.filter(c => c && c.name).map(c => ({
        name: c.name,
        seats: Number(c.seats) || 0,
        blockedSeats: c.blockedSeats || [],
        bookedSeats: c.bookedSeats || []
      }));

      const { data } = await client.post('/analytics/simulate-crowd', {
        eventId,
        eventName: eventName || 'New Event',
        popularity: eventPopularity || 0.5,
        categories: normalizedCats,
        venueMetrics
      });

      setSafetyScores(data.safetyScores || {});
      setIsSafetyMode(true);
    } catch (err) {
      console.error('Simulation error:', err);
      alert('Simulation link failed. Ensure analytics service is online.');
    } finally {
      setIsSimulating(false);
    }
  };

  const activeCategories = categories
    .filter(c => c && c.name && c.name.toString().trim() !== '')
    .map((c, i) => ({
      ...c,
      seats: Number(c.seats) || 0,
      availableSeats: c.availableSeats !== undefined ? Number(c.availableSeats) : (Number(c.seats) || 0),
      blockedSeats: Array.isArray(c.blockedSeats) ? c.blockedSeats : [],
      bookedSeats: Array.isArray(c.bookedSeats) ? c.bookedSeats : [],
      color: c.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
    }));

  const handleAutoBlock = () => {
    activeCategories.forEach((cat, idx) => {
      const score = safetyScores[cat.name] || 0;
      if (score >= 60) {
        const suggested = generateAutoBlockSeats(cat, score) || [];
        const merged = Array.from(new Set([...(cat.blockedSeats || []), ...suggested]));
        onCategoryBlockedSeatsChange(categories.findIndex(c => c.name === cat.name), merged);
      }
    });
  };

  const displayCategories = isSafetyMode ? activeCategories.map(cat => {
    const risk = safetyScores[cat.name] || 0;
    let color = '#2ecc71'; 
    if (risk >= 70) color = '#e74c3c';
    else if (risk >= 40) color = '#f1c40f';
    return { ...cat, color };
  }) : activeCategories;

  return (
    <div className="cyber-card" style={{ padding: '2rem', marginTop: '2rem', border: '1px solid var(--border-dim)' }}>
      <div className="flex-between" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h3 className="cyber-label" style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>📐 ARCHITECTURAL SCHEMATICS</h3>
          <p className="text-dim" style={{ fontSize: '0.8rem' }}>Spatial design for {eventName || 'Active Event'}</p>
        </div>
        {isAdmin && (
           <button 
             className={`cyber-btn ${isSafetyMode ? 'btn-danger active' : 'btn-outline'}`}
             onClick={toggleSafetyMode}
             disabled={isSimulating}
           >
             {isSimulating ? '⌛ CALCULATING...' : isSafetyMode ? '🛑 EXIT SAFETY SIM' : '🛡️ SAFETY SIMULATOR'}
           </button>
        )}
      </div>

      <div className="flex-column" style={{ gap: '2.5rem' }}>
        {/* Layout Type Grid */}
        <div>
          <span className="cyber-label" style={{ fontSize: '0.7rem', display: 'block', marginBottom: '1rem' }}>ARCHITECTURE TYPE</span>
          <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '1rem' }}>
            {LAYOUT_OPTIONS.map(opt => (
              <div 
                key={opt.type}
                className={`cyber-card flex-column flex-center ${layoutType === opt.type ? 'active' : ''}`}
                onClick={() => setLayoutType(opt.type)}
                style={{ 
                  padding: '1.2rem 1rem', 
                  cursor: 'pointer',
                  border: layoutType === opt.type ? '2px solid var(--accent-cyan)' : '1px solid var(--border-dim)',
                  background: layoutType === opt.type ? 'rgba(79, 172, 254, 0.05)' : 'transparent',
                  textAlign: 'center',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: '0.6rem' }}>{opt.icon}</div>
                <div className="text-main" style={{ fontSize: '0.75rem', fontWeight: '800' }}>{opt.label.toUpperCase()}</div>
                <div className="text-dim" style={{ fontSize: '0.6rem', marginTop: '4px' }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stage & Metrics */}
        <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2.5rem' }}>
          <div className="flex-column" style={{ gap: '1rem' }}>
            <span className="cyber-label" style={{ fontSize: '0.7rem' }}>STAGE ORIENTATION</span>
            <div className="flex-center" style={{ gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              {['top', 'bottom', 'center', 'left', 'right'].map(pos => (
                <button
                  key={pos}
                  className={`cyber-btn ${stagePosition === pos ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '0.5rem 1.2rem', fontSize: '0.7rem' }}
                  onClick={() => setStagePosition(pos)}
                >
                  {pos.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-column" style={{ gap: '1rem' }}>
            <span className="cyber-label" style={{ fontSize: '0.7rem' }}>CROWD FLOW LOGISTICS</span>
            <div className="flex-center" style={{ gap: '1rem' }}>
              <div className="flex-column" style={{ flex: 1 }}>
                <span className="text-dim" style={{ fontSize: '0.65rem', marginBottom: '0.4rem' }}>EXIT NODES</span>
                <input 
                  type="number" 
                  className="cyber-input" 
                  style={{ padding: '0.6rem' }}
                  value={venueMetrics.exitsCount} 
                  onChange={e => setVenueMetrics({...venueMetrics, exitsCount: parseInt(e.target.value) || 1})} 
                />
              </div>
              <div className="flex-column" style={{ flex: 2 }}>
                <span className="text-dim" style={{ fontSize: '0.65rem', marginBottom: '0.4rem' }}>SECURITY PROTOCOL</span>
                <select 
                  className="cyber-input"
                  style={{ padding: '0.6rem' }}
                  value={venueMetrics.securitySpeed}
                  onChange={e => setVenueMetrics({...venueMetrics, securitySpeed: e.target.value})}
                >
                  <option value="relaxed">RELAXED ACCESS</option>
                  <option value="standard">STANDARD PROTOCOL</option>
                  <option value="strict">STRICT BIO-SCAN</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section Colors */}
        <div>
          <span className="cyber-label" style={{ fontSize: '0.7rem', display: 'block', marginBottom: '1.2rem' }}>SPATIAL TIER IDENTIFIERS</span>
          <div className="flex-center" style={{ gap: '1.2rem', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {categories.map((cat, i) => (
              <div key={i} className="flex-center" style={{ gap: '0.6rem', position: 'relative' }}>
                <div 
                  style={{ 
                    width: '26px', 
                    height: '26px', 
                    borderRadius: '6px', 
                    background: cat.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                    cursor: 'pointer',
                    border: '2px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                  }}
                  onClick={() => setShowColorPicker(showColorPicker === i ? null : i)}
                />
                <span className="text-main" style={{ fontSize: '0.8rem', fontWeight: '700' }}>{cat.name || `Tier ${i+1}`}</span>

                {showColorPicker === i && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowColorPicker(null)} />
                    <div className="cyber-card animate-fade-up" style={{ position: 'absolute', top: '35px', left: 0, zIndex: 100, padding: '0.8rem', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
                      {COLOR_PALETTE.map(c => (
                        <div 
                          key={c}
                          style={{ width: '24px', height: '24px', borderRadius: '4px', background: c, cursor: 'pointer', border: cat.color === c ? '2px solid white' : '1px solid rgba(0,0,0,0.1)' }}
                          onClick={() => { onCategoryColorChange(i, c); setShowColorPicker(null); }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview / Simulation Status */}
        {isSafetyMode && (
          <div className="cyber-card animate-fade-up" style={{ padding: '1.5rem', background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.4)' }}>
            <div className="flex-between">
              <div className="flex-center" style={{ gap: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🛡️</span>
                <div>
                  <span className="text-glow" style={{ color: 'var(--danger)', fontWeight: '900', display: 'block' }}>CROWD-FLOW RISK ANALYSIS ACTIVE</span>
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>Graph API predicting bottleneck sectors based on exit proximity.</span>
                </div>
              </div>
              <button className="cyber-btn btn-danger" style={{ fontSize: '0.75rem', padding: '0.6rem 1.2rem' }} onClick={handleAutoBlock}>⚠️ AUTO-BLOCK RISKY SEATS</button>
            </div>
          </div>
        )}

        <div className="flex-column" style={{ gap: '1.5rem' }}>
          <div className="flex-between" style={{ borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.8rem' }}>
            <h4 className="cyber-label" style={{ fontSize: '0.85rem' }}>SPATIAL RENDER PREVIEW</h4>
            <span className="text-dim" style={{ fontSize: '0.7rem' }}>{selectedCategory ? `SELECTING: ${selectedCategory.name.toUpperCase()}` : 'SELECT A SECTOR ON MAP'}</span>
          </div>
          <div className="flex-center" style={{ background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-dim)' }}>
            <VenueMap 
              layoutType={layoutType}
              stagePosition={stagePosition}
              categories={displayCategories}
              selectedCategory={selectedCategory}
              onSelectCategory={cat => { 
                const originalCat = activeCategories.find(c => c.name === cat.name);
                setSelectedCategory(originalCat); 
                if (onSelectCategoryProp) onSelectCategoryProp(originalCat); 
              }}
              interactive={true}
              compact={true}
            />
          </div>
        </div>

        {selectedCategory && (
          <div className="animate-fade-up" style={{ marginTop: '1rem' }}>
            <SeatGrid 
              category={selectedCategory}
              isSafetyMode={isSafetyMode}
              safetyScores={safetyScores[selectedCategory.name] || {}}
              blockedSeats={selectedCategory.blockedSeats || []}
              onBlockedSeatsChange={(newBlocked) => onCategoryBlockedSeatsChange(categories.findIndex(c => c.name === selectedCategory.name), newBlocked)}
              seatMap={seatMap.find(s => s.categoryName === selectedCategory.name)?.seats || []}
              interactive={isSafetyMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default VenueLayoutDesigner;
