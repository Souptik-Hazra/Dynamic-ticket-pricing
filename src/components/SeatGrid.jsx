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

function SeatGrid({ category, selectedSeats = [], onToggleSeat, interactive = true }) {
  const layout = useMemo(() => {
    if (!category || !category.seats) return [];
    return generateSeatLayout(category.seats);
  }, [category]);

  if (!category) return null;

  const bookedSeats = category.bookedSeats || [];
  const blockedSeats = category.blockedSeats || [];

  const handleSeatClick = (seatId) => {
    if (!interactive) return;
    if (bookedSeats.includes(seatId)) return; // Can't select sold seats
    if (blockedSeats.includes(seatId) && onToggleSeat.name !== 'onToggleSeat') return; // Can't select blocked seats if buyer
    onToggleSeat(seatId);
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
                  const isBooked = bookedSeats.includes(seat.id);
                  const isBlocked = blockedSeats.includes(seat.id);
                  const isSelected = selectedSeats.includes(seat.id);
                  
                  let className = 'seat-box';
                  if (isBooked) className += ' booked';
                  else if (isBlocked) className += ' blocked';
                  else if (isSelected) className += ' selected';
                  else className += ' available';

                  if (!interactive) {
                      className += ' display-only';
                  }

                  return (
                    <div
                      key={seat.id}
                      className={className}
                      onClick={() => handleSeatClick(seat.id)}
                      title={`Seat ${seat.id}${isBooked ? ' (Sold)' : isBlocked ? ' (Blocked by Organizer)' : ''}`}
                    >
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
