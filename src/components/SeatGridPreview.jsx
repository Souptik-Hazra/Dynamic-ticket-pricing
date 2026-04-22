import React, { useState, useMemo, useCallback } from 'react';

const DEFAULT_COLORS = [
  '#FFD700', '#E040FB', '#00E5FF', '#76FF03', '#FF6D00', 
  '#448AFF', '#FF1744', '#00E676', '#D500F9', '#FFEA00'
];

function SeatGridPreview({ 
  categories = [], 
  seatMap = [], 
  onSeatMapChange,
  safetyScores = {},
  isSafetyMode = false,
  activeCategory: activeCategoryProp,
  setActiveCategory: setActiveCategoryProp
}) {
  const [localActiveCategory, setLocalActiveCategory] = useState(null);
  const activeCategory = typeof activeCategoryProp !== 'undefined' && activeCategoryProp !== null ? activeCategoryProp : localActiveCategory;
  const setActiveCategory = setActiveCategoryProp || setLocalActiveCategory;
  const [isDragging, setIsDragging] = useState(false);

  const totalSeats = useMemo(() => {
    return categories.reduce((sum, cat) => sum + (parseInt(cat.seats) || 0), 0);
  }, [categories]);

  const { rowsCount, cols } = useMemo(() => {
    if (totalSeats === 0) return { rowsCount: 0, cols: 0 };
    const c = totalSeats > 100 ? 20 : totalSeats > 50 ? 15 : 10;
    const r = Math.ceil(totalSeats / c);
    return { rowsCount: r, cols: c };
  }, [totalSeats]);

  const layout = useMemo(() => {
    if (totalSeats === 0) return [];
    const layoutConfig = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let currentSeat = 1;
    for (let r = 0; r < rowsCount; r++) {
      const rowLabel = r < 26 ? alphabet[r] : `${alphabet[Math.floor(r/26)-1]}${alphabet[r%26]}`;
      const rowSeats = [];
      for (let c = 1; c <= cols; c++) {
        if (currentSeat > totalSeats) break;
        rowSeats.push({ id: `${rowLabel}${c}`, row: rowLabel, col: c });
        currentSeat++;
      }
      layoutConfig.push({ id: rowLabel, seats: rowSeats });
    }
    return layoutConfig;
  }, [totalSeats, rowsCount, cols]);

  const seatLookup = useMemo(() => {
    const map = {};
    seatMap.forEach(s => { map[s.seatId] = s.categoryName; });
    return map;
  }, [seatMap]);

  const getCategoryColor = (catName) => {
    if (!catName) return 'rgba(255,255,255,0.05)';
    const index = categories.findIndex(c => c.name === catName);
    if (index === -1) return 'rgba(255,255,255,0.05)';
    return categories[index].color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  const handleSeatInteract = useCallback((seatId) => {
    if (!activeCategory) return;
    let newSeatMap = [...seatMap];
    const existingIdx = newSeatMap.findIndex(s => s.seatId === seatId);
    if (existingIdx >= 0) {
      if (newSeatMap[existingIdx].categoryName === activeCategory) newSeatMap.splice(existingIdx, 1);
      else newSeatMap[existingIdx].categoryName = activeCategory;
    } else {
      newSeatMap.push({ seatId, categoryName: activeCategory });
    }
    onSeatMapChange(newSeatMap);
  }, [activeCategory, seatMap, onSeatMapChange]);

  return (
    <div className="cyber-card" style={{ padding: '2rem', border: '1px solid var(--border-dim)' }}>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h4 className="cyber-label" style={{ fontSize: '0.85rem' }}>MAP DESIGNER - SEATING ASSIGNMENT</h4>
          <p className="text-dim" style={{ fontSize: '0.7rem' }}>Select a tier below and click seats to assign them spatial coordinates.</p>
        </div>
        <div className="flex-center" style={{ gap: '1rem' }}>
          <span className="text-dim" style={{ fontSize: '0.75rem' }}>Total Capacity: <span className="text-main">{totalSeats}</span></span>
          <span className="text-dim" style={{ fontSize: '0.75rem' }}>Assigned: <span className="text-glow" style={{ color: 'var(--accent-cyan)' }}>{seatMap.length}</span></span>
        </div>
      </div>

      <div className="flex-center" style={{ gap: '0.8rem', flexWrap: 'wrap', marginBottom: '2.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-dim)' }}>
        {categories.map((cat, i) => {
          const isActive = activeCategory === cat.name;
          return (
            <button
              key={cat.name}
              className={`cyber-btn ${isActive ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.7rem', padding: '0.4rem 1rem' }}
              onClick={() => setActiveCategory(isActive ? null : cat.name)}
            >
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: cat.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length], marginRight: '8px', display: 'inline-block' }} />
              {cat.name.toUpperCase()}
            </button>
          );
        })}
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
        <div className="flex-column flex-center" style={{ minWidth: '400px', gap: '6px' }}>
          <div style={{ 
            width: '60%', height: '24px', 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px dashed var(--border-dim)', 
            borderTop: 'none', 
            borderRadius: '0 0 12px 12px', 
            marginBottom: '2rem',
            color: 'var(--text-dim)',
            fontSize: '0.6rem',
            fontWeight: '900',
            letterSpacing: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>FOCUS POINT / STAGE</div>

          {layout.map((row) => (
            <div key={row.id} className="flex-center" style={{ gap: '10px' }}>
              <div className="text-dim" style={{ fontSize: '0.7rem', width: '20px', textAlign: 'center' }}>{row.id}</div>
              <div 
                className="flex-center" 
                style={{ gap: '3px' }}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                {row.seats.map(seat => {
                  const assignedCat = seatLookup[seat.id];
                  const color = getCategoryColor(assignedCat);
                  const isAssignedToActive = assignedCat === activeCategory;
                  
                  return (
                    <div
                      key={seat.id}
                      style={{
                        width: '20px', height: '20px',
                        borderRadius: '3px',
                        background: assignedCat ? color : 'rgba(255,255,255,0.03)',
                        border: isAssignedToActive ? '1px solid white' : '1px solid rgba(255,255,255,0.1)',
                        cursor: activeCategory ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.55rem',
                        color: assignedCat ? '#000' : 'rgba(255,255,255,0.2)',
                        fontWeight: '800',
                        boxShadow: isAssignedToActive ? `0 0 8px ${color}` : 'none'
                      }}
                      onClick={() => handleSeatInteract(seat.id)}
                      onMouseEnter={() => { if (isDragging) handleSeatInteract(seat.id); }}
                    >
                      {seat.col}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SeatGridPreview;
