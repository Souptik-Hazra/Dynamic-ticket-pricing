import React, { useEffect, useState } from 'react';
import VenueMap from './VenueMap';
import SeatGrid from './SeatGrid';

export default function EventMapModal({ event, onClose }) {
  const [seatOwners, setSeatOwners] = useState({});
  const eventId = event?._id;

  useEffect(() => {
    let mounted = true;
    async function fetchOwners() {
      if (!eventId) return;
      try {
        const res = await fetch(`/api/organizer/events/${eventId}/seat-owners`, { credentials: 'include' });
        if (!mounted) return;
        if (!res.ok) return; // silently ignore
        const data = await res.json();
        if (mounted && data && data.seatOwners) setSeatOwners(data.seatOwners);
      } catch {
        // ignore for now
      }
    }
    fetchOwners();
    return () => { mounted = false; };
  }, [eventId]);
  if (!event) return null;

  return (
    <div className="cyber-overlay animate-fade-up" onClick={(e) => { if (e.target.className.includes('cyber-overlay')) onClose(); }}>
      <div className="cyber-modal animate-fade-up" style={{ maxWidth: '1000px' }}>
        <header className="modal-header">
          <h2 className="text-main" style={{ margin: 0, fontSize: '1.2rem' }}>📍 Spatial Analysis: {event.name}</h2>
          <button className="cyber-btn btn-outline" style={{ padding: '0.4rem', borderRadius: '50%' }} onClick={onClose}>&times;</button>
        </header>
        <div className="modal-content">
          {event.venueLayoutType && event.venueLayoutType !== 'none' ? (
            <VenueMap
              layoutType={event.venueLayoutType}
              stagePosition={event.stagePosition || 'bottom'}
              categories={event.ticketCategories || []}
              selectedCategory={null}
              onSelectCategory={() => {}}
              interactive={false}
              showPrices={false}
            />
          ) : (
            <div className="flex-center" style={{ padding: '3rem', border: '1px dashed var(--border-dim)', borderRadius: '12px' }}>
              <p className="text-dim">No spatial layout protocols defined for this event.</p>
            </div>
          )}

          {/* Seat matrix preview: unified when seatMap exists, otherwise per-category previews */}
          <div style={{ marginTop: '2rem' }}>
            <h4 className="cyber-label" style={{ marginBottom: '1rem' }}>Neural Matrix Status (Seat Assignments)</h4>
            {event.seatMap && event.seatMap.length > 0 ? (
              <SeatGrid
                categories={event.ticketCategories || []}
                category={event.ticketCategories && event.ticketCategories[0]}
                selectedSeats={[]}
                onToggleSeat={() => {}}
                interactive={false}
                seatMap={event.seatMap}
                totalCapacity={event.capacity}
                seatOwners={seatOwners}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(event.ticketCategories || []).map((cat) => (
                  <SeatGrid
                    key={cat.name}
                    category={cat}
                    selectedSeats={[]}
                    onToggleSeat={() => {}}
                    interactive={false}
                    seatMap={[]}
                    totalCapacity={cat.seats}
                    seatOwners={seatOwners}
                  />
                ))}
                {(!event.ticketCategories || event.ticketCategories.length === 0) && (
                  <div style={{ padding: 12, color: '#ccc' }}>No ticket categories defined.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
