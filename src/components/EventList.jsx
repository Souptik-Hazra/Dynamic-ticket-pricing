import React from 'react';
import AutoPriceUpdater from './AutoPriceUpdater';

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
    <div className="cyber-container animate-fade-up" style={{ padding: '4rem 0' }}>
      <header className="flex-between" style={{ marginBottom: '3rem' }}>
        <div>
          <h1 className="title-main text-gradient" style={{ margin: 0 }}>LIVE PRODUCTIONS</h1>
          <p className="text-muted">Experience the next generation of entertainment.</p>
        </div>
        <button className="cyber-btn btn-outline" onClick={onRefresh}>
          🔄 RE-SYNC DATA
        </button>
      </header>

      {events.length === 0 ? (
        <div className="flex-center" style={{ minHeight: '300px', border: '1px dashed var(--border-dim)', borderRadius: '20px' }}>
          <p className="text-dim">No events detected in the current sector.</p>
        </div>
      ) : (
        <div className="cyber-grid">
          {events.map((event) => (
            <div key={event._id} className="cyber-card flex-column" style={{ padding: '0', gap: '0' }}>
              {/* Event Visual */}
              <div style={{ position: 'relative', height: '220px', overflow: 'hidden' }}>
                {event.image ? (
                  <img src={event.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} className="hover-scale" onError={(e) => { e.target.src = '/default-event.png'; }} />
                ) : (
                  <div className="flex-center" style={{ width: '100%', height: '100%', background: 'var(--bg-accent)', fontSize: '4rem' }}>
                    {getCategoryEmoji(event.category)}
                  </div>
                )}
                <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                  <span className={`cyber-badge badge-${event.status === 'active' ? 'success' : event.status === 'completed' ? 'info' : 'danger'}`}>
                    {event.status?.toUpperCase()}
                  </span>
                </div>
                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '2rem 1.5rem 1rem', background: 'linear-gradient(to top, var(--bg-deep), transparent)' }}>
                  <h3 className="text-main" style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>{event.name}</h3>
                </div>
              </div>

              {/* Event Content */}
              <div style={{ padding: '1.5rem' }} className="flex-column">
                <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', height: '3em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {event.description}
                </p>

                <div className="flex-column" style={{ gap: '0.8rem', marginBottom: '2rem' }}>
                  <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.8rem', fontSize: '0.85rem' }}>
                    <span className="text-dim">📍</span>
                    <span className="text-main">{event.venue}</span>
                  </div>
                  <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.8rem', fontSize: '0.85rem' }}>
                    <span className="text-dim">📅</span>
                    <div className="flex-column" style={{ gap: '0.2rem' }}>
                      <span className="text-main">Starts: {formatDateTime(event.startDate)}</span>
                      {event.endDate && (
                        <span className="text-dim" style={{ fontSize: '0.75rem' }}>
                          Ends: {formatDateTime(event.endDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Occupancy Indicator */}
                <div className="flex-column" style={{ gap: '0.5rem', marginBottom: '2rem' }}>
                  <div className="flex-between" style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <span className="text-muted">Sector Saturation</span>
                    <span className="text-glow" style={{ color: 'var(--accent-cyan)' }}>{getOccupancyPct(event)}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg-accent)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${getOccupancyPct(event)}%`, background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-indigo))', borderRadius: '3px' }} />
                  </div>
                  <span className="text-dim" style={{ fontSize: '0.7rem', textAlign: 'right' }}>
                    {getTicketsSold(event)} / {getTotalCapacity(event)} UNIT RESERVATIONS
                  </span>
                </div>

                <div className="flex-column" style={{ gap: '1rem' }}>
                  <button
                    className="cyber-btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => onSelectEvent(event)}
                    disabled={!isPurchasable(event)}
                  >
                    {event.status === 'completed' ? 'ARCHIVED' : 
                     event.status === 'cancelled' ? 'ABORTED' :
                     !isPurchasable(event) ? 'SOLD OUT' : 'INITIALIZE BOOKING'}
                  </button>
                  
                  <AutoPriceUpdater eventId={event._id} onPriceUpdate={onRefresh} compact={true} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventListWrapper(props) {
  return <EventList {...props} />;
}
