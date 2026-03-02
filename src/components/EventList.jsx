import React from 'react';
import './EventList.css';
import AutoPriceUpdater from './AutoPriceUpdater';

// Get emoji based on event category
const getCategoryEmoji = (category) => {
  const emojiMap = {
    concert: '🎵',
    sports: '⚽',
    theater: '🎭',
    conference: '💼',
    festival: '🎪',
    other: '🎟️'
  };
  return emojiMap[category?.toLowerCase()] || '🎟️';
};

function EventList({ events, onUpdatePrice, onSelectEvent, onRefresh }) {
  const formatDateTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : `${d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getOccupancyPercentage = (event) => {
    if (event.ticketCategories?.length > 0) {
      const totalSeats = event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
      const sold = event.ticketCategories.reduce((sum, cat) => sum + (cat.seats - cat.availableSeats), 0);
      return Math.min(100, (sold / totalSeats) * 100).toFixed(1);
    }
    return Math.min(100, (event.ticketsSold / event.capacity) * 100).toFixed(1);
  };

  const getTicketsSold = (event) => {
    if (event.ticketCategories?.length > 0) {
      return event.ticketCategories.reduce((sum, cat) => sum + (cat.seats - cat.availableSeats), 0);
    }
    return event.ticketsSold;
  };

  const getTotalCapacity = (event) =>
    event.ticketCategories?.length > 0
      ? event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0)
      : event.capacity;

  const isSoldOut = (event) =>
    event.ticketCategories?.length > 0
      ? event.ticketCategories.every(cat => cat.availableSeats <= 0)
      : event.ticketsSold >= event.capacity;

  // Removed daysUntil logic

  return (
    <div className="event-list-container bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <div className="list-header">
        <h2>Available Events</h2>
        <button className="refresh-btn" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>

      {events.length === 0 ? (
        <div className="no-events">
          <p>No events available. Create one to get started!</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(event => (
            <div key={event._id} className="event-card">
              <div className="event-image">
                {event.image ? (
                  <img 
                    src={event.image} 
                    alt="" 
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span 
                  className="event-emoji-placeholder" 
                  style={{ display: event.image ? 'none' : 'flex' }}
                >
                  {getCategoryEmoji(event.category)}
                </span>
                <span className="event-image-title">{event.name}</span>
                <span className={`event-status ${event.status}`}>
                  {event.status}
                </span>
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
                    <span>{formatDateTime(event.startDate) || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">📅 End:</span>
                    <span>{formatDateTime(event.endDate) || 'N/A'}</span>
                  </div>
                  {/* Removed Days Until display */}
                  <div className="detail-item">
                    <span className="label">🎭 Category:</span>
                    <span>{event.category}</span>
                  </div>
                </div>

                <div className="occupancy-bar">
                  <div className="occupancy-label">
                    <span>Occupancy</span>
                    <span>{getOccupancyPercentage(event)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${getOccupancyPercentage(event)}%` }}
                    />
                  </div>
                  <span className="capacity-text">
                    {getTicketsSold(event)} / {getTotalCapacity(event)} tickets sold
                  </span>
                </div>

                <div className="event-actions">
                  <button
                    className="btn-primary"
                    onClick={() => onSelectEvent(event)}
                    disabled={isSoldOut(event) || event.status === 'completed'}
                  >
                    {event.status === 'completed'
                      ? 'CLOSED'
                      : isSoldOut(event)
                        ? 'Sold Out'
                        : 'Buy Tickets'}
                  </button>
                </div>

                <AutoPriceUpdater 
                  eventId={event._id} 
                  onPriceUpdate={onRefresh}
                  compact={true}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

  import Footer from './Footer';

  export default function EventListWrapper(props) {
    return (
      <>
        <EventList {...props} />
        <Footer />
      </>
    );
  }
