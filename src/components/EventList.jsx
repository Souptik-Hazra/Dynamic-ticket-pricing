import React from 'react';
import './EventList.css';
import AutoPriceUpdater from './AutoPriceUpdater';
import Footer from './Footer';

// ── Category emoji map ────────────────────────────────────────────────────
const CATEGORY_EMOJI = {
  concert:    '🎵',
  sports:     '⚽',
  theater:    '🎭',
  conference: '💼',
  festival:   '🎪',
  other:      '🎟️',
};

const getCategoryEmoji = (category) =>
  CATEGORY_EMOJI[category?.toLowerCase()] || '🎟️';

// ── Helpers ───────────────────────────────────────────────────────────────
const formatDateTime = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return isNaN(d.getTime())
    ? 'N/A'
    : `${d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
};

const getOccupancyPct = (event) => {
  if (event.ticketCategories?.length > 0) {
    const total = event.ticketCategories.reduce((s, c) => s + c.seats, 0);
    const avail = event.ticketCategories.reduce((s, c) => s + (c.availableSeats ?? c.seats), 0);
    return total > 0 ? Math.min(100, (((total - avail) / total) * 100)).toFixed(1) : '0.0';
  }
  return event.capacity > 0
    ? Math.min(100, ((event.ticketsSold / event.capacity) * 100)).toFixed(1)
    : '0.0';
};

const getTicketsSold = (event) => {
  if (event.ticketCategories?.length > 0) {
    const total = event.ticketCategories.reduce((s, c) => s + c.seats, 0);
    const avail = event.ticketCategories.reduce((s, c) => s + (c.availableSeats ?? c.seats), 0);
    return total - avail;
  }
  return event.ticketsSold || 0;
};

const getTotalCapacity = (event) => {
  if (event.ticketCategories?.length > 0)
    return event.ticketCategories.reduce((s, c) => s + c.seats, 0);
  return event.capacity || 0;
};

const isPurchasable = (event) => {
  if (event.status === 'completed' || event.status === 'cancelled') return false;
  if (event.ticketCategories?.length > 0)
    return !event.ticketCategories.every((c) => (c.availableSeats ?? c.seats) <= 0);
  return event.ticketsSold < event.capacity;
};

// ── Component ─────────────────────────────────────────────────────────────
function EventList({ events, onSelectEvent, onRefresh }) {
  return (
    <div className="event-list-container bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <div className="list-header">
        <h2>Available Events</h2>
        <button className="refresh-btn" onClick={onRefresh}>🔄 Refresh</button>
      </div>

      {events.length === 0 ? (
        <div className="no-events">
          <p>No events available. Create one to get started!</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map((event) => (
            <div key={event._id} className="event-card">
              <div className="event-image">
                {event.image ? (
                  <img src={event.image} alt="" onError={(e) => { e.target.src = '/default-event.png'; }} />
                ) : null}
                <span className="event-emoji-placeholder" style={{ display: event.image ? 'none' : 'flex' }}>
                  {getCategoryEmoji(event.category)}
                </span>
                <span className="event-image-title">{event.name}</span>
                <span className={`event-status ${event.status}`}>{event.status}</span>
              </div>

              <div className="event-content">
                <h3>{event.name}</h3>
                <p className="event-description">{event.description}</p>

                <div className="event-details">
                  <div className="detail-item">
                    <span className="label">📍 Venue:</span>
                    <span>{event.venue}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">📅 Start:</span>
                    <span>{formatDateTime(event.startDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">📅 End:</span>
                    <span>{formatDateTime(event.endDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">🎭 Category:</span>
                    <span>{event.category}</span>
                  </div>
                </div>

                <div className="occupancy-bar">
                  <div className="occupancy-label">
                    <span>Occupancy</span>
                    <span>{getOccupancyPct(event)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${getOccupancyPct(event)}%` }} />
                  </div>
                  <span className="capacity-text">
                    {getTicketsSold(event)} / {getTotalCapacity(event)} tickets sold
                  </span>
                </div>

                <div className="event-actions">
                  <button
                    className="btn-primary"
                    onClick={() => onSelectEvent(event)}
                    disabled={!isPurchasable(event)}
                  >
                    {event.status === 'completed' ? 'Event Ended' : 
                     event.status === 'cancelled' ? 'Cancelled' :
                     !isPurchasable(event) ? 'Sold Out' : 'Buy Tickets'}
                  </button>
                </div>

                <AutoPriceUpdater eventId={event._id} onPriceUpdate={onRefresh} compact={true} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventListWrapper(props) {
  return (
    <>
      <EventList {...props} />
    </>
  );
}
