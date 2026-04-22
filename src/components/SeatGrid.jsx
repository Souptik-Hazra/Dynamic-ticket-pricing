import React, { useMemo } from 'react';

function generateSeatLayout(totalSeats) {
  const cols = totalSeats > 100 ? 20 : totalSeats > 50 ? 15 : 10;
  const rowsCount = Math.ceil(totalSeats / cols);
  const layout = [];
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
    layout.push({ id: rowLabel, seats: rowSeats });
  }
  return layout;
}

function SeatGrid({ category, categories = [], selectedSeats = [], onToggleSeat, interactive = true, seatMap = [], totalCapacity = 0, isSafetyMode = false, safetyScores = {} }) {
  const layout = useMemo(() => {
    if (seatMap && seatMap.length > 0 && totalCapacity > 0) return generateSeatLayout(totalCapacity);
    if (!category || !category.seats) return [];
    return generateSeatLayout(category.seats);
  }, [category, seatMap, totalCapacity]);

  const seatLookup = useMemo(() => {
    const map = {};
    if (seatMap) seatMap.forEach(s => { map[s.seatId] = s.categoryName; });
    return map;
  }, [seatMap]);

  const multiMode = Array.isArray(categories) && categories.length > 0 && seatMap && seatMap.length > 0;
  if (!multiMode && !category) return null;

  const handleSeatClick = (seatId, seatCategoryName) => {
    if (!interactive) return;
    const targetCategory = multiMode ? categories.find(c => c.name === seatCategoryName) : category;
    if (!targetCategory) return;
    const bookedSeats = targetCategory.bookedSeats || [];
    const blockedSeats = targetCategory.blockedSeats || [];
    if (bookedSeats.includes(seatId)) return;
    if (onToggleSeat) onToggleSeat(seatId);
  };

  return (
    <div className="cyber-card" style={{ padding: '2rem', border: '1px solid var(--border-dim)', background: 'rgba(5, 9, 20, 0.4)' }}>
      <div className="flex-between" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-dim)', paddingBottom: '1rem' }}>
        <h4 className="cyber-label" style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
          {(category?.name || 'SECTOR').toUpperCase()} CONFIGURATION
        </h4>
        <div className="flex-center" style={{ gap: '1.2rem' }}>
          <div className="flex-center" style={{ gap: '0.4rem' }}>
             <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71' }}></div>
             <span className="text-dim" style={{ fontSize: '0.7rem' }}>AVAILABLE</span>
          </div>
          <div className="flex-center" style={{ gap: '0.4rem' }}>
             <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-cyan)', boxShadow: '0 0 10px var(--accent-cyan)' }}></div>
             <span className="text-dim" style={{ fontSize: '0.7rem' }}>SELECTED</span>
          </div>
          <div className="flex-center" style={{ gap: '0.4rem' }}>
             <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--bg-deep)', border: '1px solid var(--border-dim)' }}></div>
             <span className="text-dim" style={{ fontSize: '0.7rem' }}>BLOCKED</span>
          </div>
          <div className="flex-center" style={{ gap: '0.4rem' }}>
             <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}></div>
             <span className="text-dim" style={{ fontSize: '0.7rem' }}>SOLD</span>
          </div>
        </div>
      </div>
      
      <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
        <div className="flex-column flex-center" style={{ minWidth: '400px', gap: '8px' }}>
          <div style={{ 
            width: '60%', height: '30px', 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px dashed var(--border-dim)', 
            borderTop: 'none', 
            borderRadius: '0 0 15px 15px', 
            marginBottom: '2.5rem',
            color: 'var(--text-dim)',
            fontSize: '0.7rem',
            fontWeight: '900',
            letterSpacing: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>STAGE AREA</div>
          
          {layout.map((row) => (
            <div key={row.id} className="flex-center" style={{ gap: '12px' }}>
              <div className="text-dim" style={{ fontSize: '0.75rem', width: '20px', textAlign: 'center', fontWeight: '800' }}>{row.id}</div>
              <div className="flex-center" style={{ gap: '4px' }}>
                {row.seats.map(seat => {
                  const assignedCategoryName = seatLookup[seat.id];
                  const assignedCategory = multiMode ? categories.find(c => c.name === assignedCategoryName) : category;
                  const isBooked = assignedCategory?.bookedSeats?.includes(seat.id);
                  const isBlocked = assignedCategory?.blockedSeats?.includes(seat.id);
                  const isSelected = selectedSeats.includes(seat.id);

                  let baseStyle = {
                    width: '24px', height: '24px',
                    borderRadius: '4px',
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: interactive && !isBooked ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                  };

                  let stateStyle = {
                    background: 'rgba(46, 204, 113, 0.1)',
                    border: '1px solid rgba(46, 204, 113, 0.4)',
                    color: '#2ecc71'
                  };

                  if (isBooked) {
                    stateStyle = {
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.2)',
                    };
                  } else if (isBlocked) {
                    stateStyle = {
                      background: 'var(--bg-deep)',
                      border: '1px solid var(--border-dim)',
                      color: 'var(--text-dim)',
                      opacity: 0.6
                    };
                  } else if (isSelected) {
                    stateStyle = {
                      background: 'var(--accent-cyan)',
                      border: '1px solid var(--accent-cyan)',
                      color: '#000',
                      boxShadow: '0 0 12px var(--accent-cyan)',
                    };
                  }

                  if (multiMode && assignedCategoryName && !isSelected && !isBooked && !isBlocked) {
                    const catColor = assignedCategory?.color || '#333';
                    stateStyle = { ...stateStyle, background: `${catColor}22`, border: `1px solid ${catColor}66`, color: catColor };
                  }

                  return (
                    <div 
                      key={seat.id} 
                      style={{ ...baseStyle, ...stateStyle }}
                      onClick={() => handleSeatClick(seat.id, assignedCategoryName)}
                      title={`${seat.id} - ${assignedCategoryName || 'Unassigned'}`}
                    >
                      {seat.col}
                    </div>
                  );
                })}
              </div>
              <div className="text-dim" style={{ fontSize: '0.75rem', width: '20px', textAlign: 'center', fontWeight: '800' }}>{row.id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SeatGrid;
