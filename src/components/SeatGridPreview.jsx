import React, { useState, useMemo, useCallback } from 'react';
import './SeatGridPreview.css';

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

  // 1. Calculate Grid Dimensions based on total declared capacity
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
        rowSeats.push({
          id: `${rowLabel}${c}`,
          row: rowLabel,
          col: c
        });
        currentSeat++;
      }
      layoutConfig.push({ id: rowLabel, seats: rowSeats });
    }
    return layoutConfig;
  }, [totalSeats, rowsCount, cols]);

  // Transform seatMap array to a quick lookup map O(1)
  const seatLookup = useMemo(() => {
    const map = {};
    seatMap.forEach(s => {
      map[s.seatId] = s.categoryName;
    });
    return map;
  }, [seatMap]);

  // Validation Checkers
  const categoryCounts = useMemo(() => {
    const counts = {};
    seatMap.forEach(s => {
      counts[s.categoryName] = (counts[s.categoryName] || 0) + 1;
    });
    return counts;
  }, [seatMap]);

  const getCategoryColor = (catName) => {
    if (!catName) return '#eee';
    const index = categories.findIndex(c => c.name === catName);
    if (index === -1) return '#eee';
    return categories[index].color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  const handleSeatInteract = useCallback((seatId) => {
    if (!activeCategory) return;
    
    // Toggle logic: if already assigned to THIS category, remove it. Else assign it.
    let newSeatMap = [...seatMap];
    const existingIdx = newSeatMap.findIndex(s => s.seatId === seatId);
    
    if (existingIdx >= 0) {
      if (newSeatMap[existingIdx].categoryName === activeCategory) {
        newSeatMap.splice(existingIdx, 1); // remove
      } else {
        newSeatMap[existingIdx].categoryName = activeCategory; // overwrite
      }
    } else {
      newSeatMap.push({ seatId, categoryName: activeCategory });
    }
    onSeatMapChange(newSeatMap);
  }, [activeCategory, seatMap, onSeatMapChange]);

  const handleMouseDown = (seatId) => {
    setIsDragging(true);
    handleSeatInteract(seatId);
  };

  const handleMouseEnter = (seatId) => {
    if (isDragging) {
      handleSeatInteract(seatId);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (totalSeats === 0) {
    return (
      <div className="seat-grid-preview-container">
        <div className="sgp-empty">
          Define Ticket Categories and Seat amounts on the left to generate the Live Blueprint.
        </div>
      </div>
    );
  }

  return (
    <div className="seat-grid-preview-container" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="sgp-header">
        <h3>🎨 Live Seat Map Blueprint</h3>
        
        {/* Paint Palette */}
        <div className="sgp-paint-palette">
          {categories.map((cat, i) => {
            if (!cat.name) return null;
            const targetColor = cat.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
            const currentCount = categoryCounts[cat.name] || 0;
            const targetCount = parseInt(cat.seats) || 0;
            const isOver = currentCount > targetCount;
            
            return (
              <div 
                key={i} 
                className={`sgp-cat-btn ${activeCategory === cat.name ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.name)}
                style={{ borderColor: activeCategory === cat.name ? targetColor : 'transparent' }}
              >
                <div className="sgp-cat-color" style={{ background: targetColor }}></div>
                {cat.name.toUpperCase()} 
                <span style={{ color: isOver ? '#d32f2f' : '#666', fontSize: '11px', marginLeft: '4px' }}>
                  ({currentCount}/{targetCount})
                </span>
              </div>
            );
          })}
          <div 
            className={`sgp-cat-btn ${activeCategory === 'erase' ? 'active' : ''}`}
            onClick={() => setActiveCategory('erase')}
          >
            🧹 Eraser
          </div>
        </div>

        {/* Validation Matrix */}
        <div className="sgp-validation">
          {categories.map((cat, i) => {
            if (!cat.name) return null;
            const currentCount = categoryCounts[cat.name] || 0;
            const targetCount = parseInt(cat.seats) || 0;
            const remaining = targetCount - currentCount;
            const isMatch = currentCount === targetCount;
            const isOver = currentCount > targetCount;

            let message = null;
            if (isMatch) {
              message = <span>✅ Perfect allocation</span>;
            } else if (isOver) {
              const overBy = currentCount - targetCount;
              message = <span>❌ Overallocated by {overBy} seats</span>;
            } else if (remaining <= 5) {
              message = <span>⚠️ Almost there — only {remaining} seats left</span>;
            } else {
              message = <span>⚠️ Needs {remaining} more seats</span>;
            }

            return (
              <div key={i} className={`sgp-val-item ${isMatch ? 'valid' : isOver ? 'invalid' : ''}`}>
                <span>{cat.name.toUpperCase()}</span>
                {message}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sgp-grid-wrapper">
        <div className="sgp-grid">
          {layout.map(row => (
            <div key={row.id} className="sgp-row">
              <div className="sgp-row-label">{row.id}</div>
              {row.seats.map(seat => {
                const assignedCat = seatLookup[seat.id];
                const color = getCategoryColor(assignedCat);
                const isDanger = isSafetyMode && assignedCat && safetyScores[assignedCat] >= 70;
                
                return (
                  <div 
                    key={seat.id}
                    className={`sgp-seat ${isDanger ? 'danger' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); handleMouseDown(seat.id); }}
                    onMouseEnter={() => handleMouseEnter(seat.id)}
                    title={`Seat ${seat.id}${assignedCat ? ` - ${assignedCat}` : ''}${isDanger ? ' (High Risk Bottleneck)' : ''}`}
                  >
                    <div className="sgp-seat-inner" style={{ background: color }}></div>
                    {seat.col}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SeatGridPreview;
