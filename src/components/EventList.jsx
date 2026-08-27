import React, { useState, useMemo } from 'react';
import './EventList.css';
import AutoPriceUpdater from './AutoPriceUpdater';
import Footer from './Footer';

// Get emoji based on event category
const getCategoryEmoji = (category) => {
  const emojiMap = {
    concert: '🎵',
    sports: '⚽',
    theater: '🎭',
    conference: '💼',
    festival: '🎪',
    comedy: '🎙️',
    cinema: '🎬',
    other: '🎟️'
  };
  return emojiMap[category?.toLowerCase()] || '🎟️';
};

function EventList({ events = [], onUpdatePrice, onSelectEvent, onRefresh }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

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
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      const totalSeats = event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
      const totalAvailable = event.ticketCategories.reduce((sum, cat) => sum + cat.availableSeats, 0);
      const sold = totalSeats - totalAvailable;
      return Math.min(100, ((sold / totalSeats) * 100)).toFixed(1);
    }
    return Math.min(100, (((event.ticketsSold || 0) / (event.capacity || 1)) * 100)).toFixed(1);
  };

  const getTicketsSold = (event) => {
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      const totalSeats = event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
      const totalAvailable = event.ticketCategories.reduce((sum, cat) => sum + cat.availableSeats, 0);
      return totalSeats - totalAvailable;
    }
    return event.ticketsSold || 0;
  };

  const getTotalCapacity = (event) => {
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      return event.ticketCategories.reduce((sum, cat) => sum + cat.seats, 0);
    }
    return event.capacity || 0;
  };

  const isSoldOut = (event) => {
    if (event.ticketCategories && event.ticketCategories.length > 0) {
      return event.ticketCategories.every(cat => cat.availableSeats <= 0);
    }
    return (event.ticketsSold || 0) >= (event.capacity || 0);
  };

  // Filter events based on search, category, and status
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = !searchTerm ||
        event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.venue.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || event.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [events, searchTerm, selectedCategory, selectedStatus]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredEvents.length);
  const currentEvents = filteredEvents.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (e) => {
    setSelectedStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  return (
    <div className="event-list-container bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-screen">
      <div className="list-header">
        <div>
          <h2>Available Events</h2>
          {filteredEvents.length > 0 && (
            <p className="event-results-count">
              Showing {startIndex + 1}-{endIndex} of {filteredEvents.length} events
            </p>
          )}
        </div>
        <button className="refresh-btn" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="event-filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search events by name or venue..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="filter-input"
          />
        </div>

        <div className="filter-dropdowns">
          <select value={selectedCategory} onChange={handleCategoryChange} className="filter-select">
            <option value="all">All Categories</option>
            <option value="concert">Concerts</option>
            <option value="sports">Sports</option>
            <option value="theater">Theater</option>
            <option value="festival">Festival</option>
            <option value="conference">Conference</option>
            <option value="comedy">Comedy</option>
          </select>

          <select value={selectedStatus} onChange={handleStatusChange} className="filter-select">
            <option value="all">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>

          <div className="items-per-page-selector">
            <label>Show:</label>
            <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="filter-select compact">
              <option value={3}>3</option>
              <option value={6}>6</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
            </select>
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="no-events">
          <p>No events found matching your criteria.</p>
        </div>
      ) : (
        <>
          <div className="events-grid">
            {currentEvents.map(event => (
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
                      onClick={() => onSelectEvent && onSelectEvent(event)}
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

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="pagination-btn prev-next"
                onClick={() => handlePageChange(validCurrentPage - 1)}
                disabled={validCurrentPage === 1}
              >
                ◀ Prev
              </button>

              <div className="pagination-numbers">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNum = index + 1;
                  return (
                    <button
                      key={pageNum}
                      className={`pagination-btn number ${validCurrentPage === pageNum ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                className="pagination-btn prev-next"
                onClick={() => handlePageChange(validCurrentPage + 1)}
                disabled={validCurrentPage === totalPages}
              >
                Next ▶
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function EventListWrapper(props) {
  return (
    <>
      <EventList {...props} />
      <Footer />
    </>
  );
}
