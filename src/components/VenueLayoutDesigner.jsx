import React, { useState } from 'react';
import VenueMap from './VenueMap';
import SeatGrid from './SeatGrid';
import { simulateCrowdSafety, generateAutoBlockSeats } from '../utils/CrowdSimulator';
import './VenueLayoutDesigner.css';

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
}) {
  const [showColorPicker, setShowColorPicker]   = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isSafetyMode, setIsSafetyMode]         = useState(false);
  const [safetyScores, setSafetyScores]         = useState({});

  const toggleSafetyMode = () => {
    if (!isSafetyMode) {
      const scores = simulateCrowdSafety(categories.filter(c => c.name), layoutType, stagePosition, venueMetrics);
      setSafetyScores(scores);
    }
    setIsSafetyMode(!isSafetyMode);
  };

  const activeCategories = categories.filter(c => c.name);
  
  const displayCategories = isSafetyMode ? activeCategories.map(cat => {
    const risk = safetyScores[cat.name] || 0;
    // Map risk to Red/Yellow/Green
    let color = '#2ecc71'; // Green (Safe)
    if (risk >= 70) color = '#e74c3c'; // Red (Danger)
    else if (risk >= 40) color = '#f1c40f'; // Yellow (Warning)
    
    return { ...cat, color };
  }) : activeCategories;

  return (
    <div className="venue-layout-designer">
      <h3 className="vld-title">🗺️ Venue Layout</h3>
      <p className="vld-subtitle">Choose how your venue looks to ticket buyers</p>

      {/* Layout Type Selector */}
      <div className="vld-type-grid">
        {LAYOUT_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            className={`vld-type-card ${layoutType === opt.type ? 'vld-type-active' : ''}`}
            onClick={() => setLayoutType(opt.type)}
          >
            <span className="vld-type-icon">{opt.icon}</span>
            <span className="vld-type-label">{opt.label}</span>
            <span className="vld-type-desc">{opt.desc}</span>
          </button>
        ))}
      </div>

      {/* Stage Position (only for applicable layouts) */}
      {layoutType !== 'none' && (
        <div className="vld-stage-position">
          <label className="vld-field-label">Stage / Screen Position</label>
          <div className="vld-stage-options">
            {['top', 'bottom', 'left', 'right', 'center'].map((pos) => (
              <button
                key={pos}
                type="button"
                className={`vld-stage-btn ${stagePosition === pos ? 'vld-stage-active' : ''}`}
                onClick={() => setStagePosition(pos)}
              >
                {pos === 'top' && '⬆️'}
                {pos === 'bottom' && '⬇️'}
                {pos === 'left' && '⬅️'}
                {pos === 'right' && '➡️'}
                {pos === 'center' && '🎯'}
                <span>{pos.charAt(0).toUpperCase() + pos.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section Colors */}
      {layoutType !== 'none' && categories.length > 0 && (
        <div className="vld-colors-section">
          <label className="vld-field-label">Section Colors</label>
          <div className="vld-color-list">
            {categories.map((cat, i) => {
              const currentColor = cat.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
              return (
                <div key={i} className="vld-color-item">
                  <div
                    className="vld-color-swatch"
                    style={{ background: currentColor }}
                    onClick={() => setShowColorPicker(showColorPicker === i ? null : i)}
                  />
                  <span className="vld-color-name">
                    {(cat.name || `Section ${i + 1}`).toUpperCase()}
                  </span>
                  {showColorPicker === i && (
                    <div className="vld-color-popover">
                      <div className="vld-color-backdrop" onClick={() => setShowColorPicker(null)} />
                      <div className="vld-color-palette">
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`vld-palette-btn ${currentColor === c ? 'vld-palette-active' : ''}`}
                            style={{ background: c }}
                            onClick={() => {
                              onCategoryColorChange(i, c);
                              setShowColorPicker(null);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Constraints Panel (Physical Venue Metrics) */}
      {layoutType !== 'none' && (
        <div className="vld-constraints-section">
          <label className="vld-field-label">Architectural Constraints (Simulated Risk)</label>
          <div className="vld-constraints-grid">
            <div className="vld-constraint-item">
              <label>Number of Physical Exits</label>
              <input
                type="number"
                min="1"
                max="20"
                value={venueMetrics.exitsCount}
                onChange={(e) => {
                  setVenueMetrics(prev => ({ ...prev, exitsCount: parseInt(e.target.value) || 1 }));
                  setIsSafetyMode(false); // Reset simulation if metrics change
                }}
              />
            </div>
            <div className="vld-constraint-item">
              <label>Aisle Flow Width</label>
              <select
                value={venueMetrics.aisleWidth}
                onChange={(e) => {
                  setVenueMetrics(prev => ({ ...prev, aisleWidth: e.target.value }));
                  setIsSafetyMode(false);
                }}
              >
                <option value="narrow">Narrow (High Crush Risk)</option>
                <option value="standard">Standard</option>
                <option value="wide">Wide (Safe Flow)</option>
              </select>
            </div>
            <div className="vld-constraint-item">
              <label>Security/Gate Speed</label>
              <select
                value={venueMetrics.securitySpeed}
                onChange={(e) => {
                  setVenueMetrics(prev => ({ ...prev, securitySpeed: e.target.value }));
                  setIsSafetyMode(false);
                }}
              >
                <option value="slow">Slow (Bottlenecks)</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast (Smooth)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview & Simulation */}
      {layoutType !== 'none' && activeCategories.length > 0 && (
        <div className="vld-preview">
          <div className="vld-preview-header">
            <label className="vld-field-label">Live Preview {selectedCategory ? `— ${selectedCategory.name.toUpperCase()}` : '(Click a map section)'}</label>
            <button 
              type="button" 
              className={`btn-safety-sim ${isSafetyMode ? 'active' : ''}`}
              onClick={toggleSafetyMode}
            >
              {isSafetyMode ? '🛑 Exit Safety Simulation' : '🔮 Run Crowd Safety Simulation'}
            </button>
          </div>
          
          <VenueMap
            layoutType={layoutType}
            stagePosition={stagePosition}
            categories={displayCategories}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
               const originalCat = activeCategories.find(c => c.name === cat.name);
               setSelectedCategory(originalCat);
            }}
            showPrices={false}
            interactive={true}
            compact={true}
          />

          {selectedCategory && (
            <div className={`vld-seat-preview ${isSafetyMode ? 'safety-mode-active' : ''}`}>
              {isSafetyMode && (
                <div className="safety-action-bar">
                  <span className="safety-risk-label">
                     Risk Score: {safetyScores[selectedCategory.name] || 0}/100 
                  </span>
                  {(safetyScores[selectedCategory.name] || 0) >= 60 && (
                    <button 
                      type="button" 
                      className="btn-auto-block"
                      onClick={() => {
                        const originalIndex = categories.findIndex(c => c.name === selectedCategory.name);
                        const suggestedBlocks = generateAutoBlockSeats(selectedCategory, safetyScores[selectedCategory.name]);
                        const newBlocks = [...new Set([...(selectedCategory.blockedSeats||[]), ...suggestedBlocks])];
                        onCategoryBlockedSeatsChange(originalIndex, newBlocks);
                        setSelectedCategory({ ...selectedCategory, blockedSeats: newBlocks });
                      }}
                    >
                      ⚠️ Auto-Block Risky Seats
                    </button>
                  )}
                </div>
              )}
              
              <SeatGrid
                category={selectedCategory}
                interactive={isSafetyMode}
                selectedSeats={[]}
                onToggleSeat={(seatId) => {
                  if (!isSafetyMode) return;
                  const originalIndex = categories.findIndex(c => c.name === selectedCategory.name);
                  const currentBlocks = selectedCategory.blockedSeats || [];
                  const newBlocks = currentBlocks.includes(seatId) 
                    ? currentBlocks.filter(id => id !== seatId) 
                    : [...currentBlocks, seatId];
                  onCategoryBlockedSeatsChange(originalIndex, newBlocks);
                  setSelectedCategory({ ...selectedCategory, blockedSeats: newBlocks });
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VenueLayoutDesigner;
