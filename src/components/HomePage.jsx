import { useState, useEffect } from 'react';
import axios from 'axios';
import './HomePage.css';

const HomePage = ({ onNavigate }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/events');
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', 'concert', 'sports', 'theater', 'conference', 'festival'];

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || event.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="loading-spinner">Loading amazing events...</div>;
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">Discover Amazing Events</h1>
          <p className="hero-subtitle">Book your tickets with dynamic pricing - Best deals guaranteed!</p>
          <div className="hero-search">
            <input
              type="text"
              placeholder="Search for events, artists, venues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button className="search-button">
              <i className="search-icon">🔍</i> Search
            </button>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="category-section">
        <div className="category-container">
          <h2>Browse by Category</h2>
          <div className="category-buttons">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-btn ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="events-section">
        <div className="events-container">
          <h2>Upcoming Events</h2>
          {filteredEvents.length === 0 ? (
            <div className="no-events">
              <p>No events found. Check back soon!</p>
            </div>
          ) : (
            <div className="events-grid" onClick={() => onNavigate('booking', event)}>
              {filteredEvents.map(event => (
                <div key={event._id} className="event-card">
                  <div className="event-image">
                    <div className="event-badge">{event.category}</div>
                    <div className="event-date-badge">
                      {event.startDate && event.endDate
                        ? `${new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : event.startDate
                          ? new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : event.endDate
                            ? new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'Date not set'}
                    </div>
                  </div>
                  <div className="event-content">
                    <h3 className="event-title">{event.name}</h3>
                    <p className="event-venue">📍 {event.venue}</p>
                    <p className="event-description">{event.description.substring(0, 100)}...</p>
                    
                    <div className="event-details">
                      <div className="event-capacity">
                        <span className="capacity-label">Availability</span>
                        <div className="capacity-bar">
                          <div 
                            className="capacity-fill" 
                            style={{ width: `${(event.ticketsSold / event.capacity) * 100}%` }}
                          ></div>
                        </div>
                        <span className="capacity-text">
                          {event.capacity - event.ticketsSold} / {event.capacity} left
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <h2>Why Choose Us?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Dynamic Pricing</h3>
              <p>AI-powered pricing gives you the best deals based on demand</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure Booking</h3>
              <p>Your transactions are protected with bank-level security</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Instant Confirmation</h3>
              <p>Get your tickets immediately after booking</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Tickets</h3>
              <p>Access your tickets anytime, anywhere on your device</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
