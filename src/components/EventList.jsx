import React from 'react';
import './EventList.css';
import AutoPriceUpdater from './AutoPriceUpdater';

function EventList({ events, onUpdatePrice, onSelectEvent, onRefresh }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getOccupancyPercentage = (event) => {
    // Calculate from category data if available
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      const totalSeats = event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
      const totalAvailable = event.ticketCategories.reduce((sum, cat) => sum + cat.availableSeats, 0);
      const sold = totalSeats - totalAvailable;
      return Math.min(100, ((sold / totalSeats) * 100)).toFixed(1);
    }
    return Math.min(100, ((event.ticketsSold / event.capacity) * 100)).toFixed(1);
  };

  const getTicketsSold = (event) => {
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      const totalSeats = event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
      const totalAvailable = event.ticketCategories.reduce((sum, cat) => sum + cat.availableSeats, 0);
      return totalSeats - totalAvailable;
    }
    return event.ticketsSold;
  };

  const getTotalCapacity = (event) => {
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      return event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
    }
    return event.capacity;
  };

  const isSoldOut = (event) => {
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      return event.ticketCategories.every(cat => cat.availableSeats <= 0);
    }
    return event.ticketsSold >= event.capacity;
  };

  const getDaysUntil = (date) => {
    const now = new Date();
    const eventDate = new Date(date);
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  return (
    <div className="event-list-container">
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
                <img src={event.image} alt="" />
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
                    <span className="label">📅 Date:</span>
                    <span>{formatDate(event.eventDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">⏰ Days Until:</span>
                    <span>{getDaysUntil(event.eventDate)} days</span>
                  </div>
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
                    disabled={isSoldOut(event)}
                  >
                    {isSoldOut(event) ? 'Sold Out' : 'Buy Tickets'}
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

export default EventList;
