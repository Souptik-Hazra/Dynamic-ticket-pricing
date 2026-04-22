import React, { useMemo } from 'react';
import './SeatGrid.css';

function generateSeatLayout(totalSeats) {
  // Simple square-ish grid
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
      rowSeats.push({
        id: `${rowLabel}${c}`,
        row: rowLabel,
        col: c
      });
      currentSeat++;
    }
    layout.push({ id: rowLabel, seats: rowSeats });
  }
  return layout;
}

function SeatGrid({ category, categories = [], selectedSeats = [], onToggleSeat, interactive = true, seatMap = [], totalCapacity = 0, seatOwners = {} }) {
  const layout = useMemo(() => {
    if (seatMap && seatMap.length > 0 && totalCapacity > 0) {
      return generateSeatLayout(totalCapacity); // Global unified grid
    }
    if (!category || !category.seats) return [];
    return generateSeatLayout(category.seats); // Fallback: per-category grid
  }, [category, categories, seatMap, totalCapacity]);

  const seatLookup = useMemo(() => {
    const map = {};
    if (seatMap) {
      seatMap.forEach(s => { map[s.seatId] = s.categoryName; });
    }
    return map;
  }, [seatMap]);

  // If categories provided (multi-category view), we'll render all seats and color by assigned category
  const multiMode = Array.isArray(categories) && categories.length > 0 && seatMap && seatMap.length > 0;

  // If not multiMode, category prop must exist
  if (!multiMode && !category) return null;

  const handleSeatClick = (seatId, seatCategoryName) => {
    if (!interactive) return;
    if (multiMode) {
      // In multi-mode we don't allow toggling (display-only) unless interactive is true and seat belongs to a single selected category
      if (!onToggleSeat) return;
      const catName = seatCategoryName;
      // if seat belongs to a different category than the primary `category` prop, ignore
      if (category && catName && catName !== category.name) return;
    }
    // Per-category selection checks
    const targetCategory = multiMode ? categories.find(c => c.name === seatCategoryName) : category;
    const bookedSeats = (targetCategory && targetCategory.bookedSeats) || [];
    const blockedSeats = (targetCategory && targetCategory.blockedSeats) || [];
    if (bookedSeats.includes(seatId)) return;
    if (blockedSeats.includes(seatId) && onToggleSeat && onToggleSeat.name !== 'onToggleSeat') return;
    if (onToggleSeat) onToggleSeat(seatId);
  };

  return (
    <div className="seat-grid-container">
      <div className="seat-grid-header">
        <h4>{category.name.toUpperCase()} - SEATING</h4>
        <div className="seat-legend">
          <div className="seat-legend-item"><div className="seat-box available"></div> Available</div>
          <div className="seat-legend-item"><div className="seat-box selected"></div> Selected</div>
          <div className="seat-legend-item"><div className="seat-box blocked"></div> Blocked</div>
          <div className="seat-legend-item"><div className="seat-box booked"></div> Sold</div>
        </div>
      </div>
      
      <div className="seat-layout-scroll">
        <div className="seat-layout">
          <div className="stage-indicator">STAGE</div>
          
          {layout.map((row) => (
            <div key={row.id} className="seat-row">
              <div className="seat-row-label">{row.id}</div>
              <div className="seat-row-seats">
                {row.seats.map(seat => {
                  const assignedCategoryName = seatLookup[seat.id];
                  const assignedCategory = multiMode ? categories.find(c => c.name === assignedCategoryName) : category;
                  const isBooked = assignedCategory && assignedCategory.bookedSeats ? assignedCategory.bookedSeats.includes(seat.id) : false;
                  const isBlocked = assignedCategory && assignedCategory.blockedSeats ? assignedCategory.blockedSeats.includes(seat.id) : false;
                  const isSelected = selectedSeats.includes(seat.id);

                  let className = 'seat-box';
                  if (multiMode) {
                    // color by assigned category; display-only if no assignment
                    if (!assignedCategoryName) className += ' display-only';
                    else className += ` category-${assignedCategoryName.replace(/\s+/g,'-').toLowerCase()}`;
                    if (isBooked) className += ' booked';
                    else if (isBlocked) className += ' blocked';
                    else if (isSelected) className += ' selected';
                  } else {
                    if (isBooked) className += ' booked';
                    else if (isBlocked) className += ' blocked';
                    else if (isSelected) className += ' selected';
                    else className += ' available';
                  }

                  if (!interactive) {
                    className += ' display-only';
                  }

                  const ownerName = (seatOwners && (seatOwners[seat.id] || seatOwners.find?.(s => s.seatId === seat.id)?.customerName)) || null;

                  return (
                    <div
                      key={seat.id}
                      className={className}
                      onClick={() => handleSeatClick(seat.id, assignedCategoryName)}
                      title={`Seat ${seat.id}${assignedCategoryName ? ` (${assignedCategoryName})` : ''}${ownerName ? ` — ${ownerName}` : isBooked ? ' (Sold)' : isBlocked ? ' (Blocked)' : ''}`}
                    >
                      {ownerName && (
                        <div className="seat-hover-name">{ownerName}</div>
                      )}
                      {seat.col}
                    </div>
                  );
                })}
              </div>
              <div className="seat-row-label">{row.id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SeatGrid;
