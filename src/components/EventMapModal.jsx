import React, { useEffect, useState } from 'react';
import VenueMap from './VenueMap';
import SeatGrid from './SeatGrid';
import './EventMapModal.css';

export default function EventMapModal({ event, onClose }) {
  const [seatOwners, setSeatOwners] = useState({});

  useEffect(() => {
    let mounted = true;
    async function fetchOwners() {
      if (!event || !event._id) return;
      try {
        const res = await fetch(`/api/organizer/events/${event._id}/seat-owners`, { credentials: 'include' });
        if (!mounted) return;
        if (!res.ok) return; // silently ignore
        const data = await res.json();
        if (mounted && data && data.seatOwners) setSeatOwners(data.seatOwners);
      } catch (err) {
        // ignore for now
      }
    }
    fetchOwners();
    return () => { mounted = false; };
  }, [event && event._id]);
  if (!event) return null;

  return (
    <div className="event-map-overlay" onClick={(e) => { if (e.target.className === 'event-map-overlay') onClose(); }}>
      <div className="event-map-modal">
        <div className="event-map-header">
          <h3>Venue Map — {event.name}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="event-map-body">
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
            <div style={{ padding: 20 }}>No layout defined for this event.</div>
          )}

          {/* Seat matrix preview: unified when seatMap exists, otherwise per-category previews */}
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: '8px 0' }}>Seat assignments</h4>
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
