import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';

const HomePage = ({ onNavigate }) => {
  const { data: events = [], isLoading: loading } = useEvents();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = ['all', 'concert', 'sports', 'theater', 'conference', 'festival'];

  const filteredEvents = events.filter(event => {
    const matchesSearch = (event.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (event.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || event.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="text-glow title-sub">Loading amazing events...</div>
      </div>
    );
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section cyber-section animate-fade-up" style={{ padding: '3rem 0' }}>
        <div className="cyber-container flex-column flex-center" style={{ textAlign: 'center' }}>
          <div className="hero-content flex-column flex-center">
            <h1 className="title-main text-gradient" style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>The Future of Event Ticketing</h1>
            <p className="title-sub">Experience AI-powered dynamic pricing for the most exclusive events.</p>

            <div className="hero-search">
              <input
                type="text"
                placeholder="Search for events, artists, venues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="cyber-btn btn-primary">
                🔍 SEARCH
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="category-section cyber-section">
        <div className="cyber-container">
          <h2 className="title-sub flex-center">Browse by Category</h2>
          <div className="flex-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`cyber-btn ${categoryFilter === cat ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="events-section cyber-section">
        <div className="cyber-container">
          <h2 className="title-sub">Featured Events</h2>
          {filteredEvents.length === 0 ? (
            <div className="cyber-card flex-center">
              <p className="text-muted">No events found. Check back soon!</p>
            </div>
          ) : (
            <div className="cyber-grid">
              {filteredEvents.map(event => (
                <div key={event._id} className="cyber-card" onClick={() => onNavigate('purchase', event)} style={{ padding: 0 }}>
                  <div className="event-image" style={{
                    backgroundImage: `url(${event.image || '/default-event.png'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    height: '200px',
                    position: 'relative'
                  }}>
                    <div className="cyber-badge badge-info" style={{ position: 'absolute', top: '15px', left: '15px' }}>{event.category}</div>
                    <div className={`cyber-badge badge-${event.status === 'active' ? 'success' : 'danger'}`} style={{ position: 'absolute', top: '15px', right: '15px' }}>{event.status}</div>

                    <div className="glass-panel" style={{
                      position: 'absolute',
                      bottom: '15px',
                      left: '15px',
                      padding: '8px 15px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      textTransform: 'uppercase'
                    }}>
                      {event.startDate ? (
                        <div className="flex-column" style={{ gap: '2px' }}>
                          <span>{new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          {event.endDate && <span className="text-dim" style={{ fontSize: '0.65rem' }}>to {new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        </div>
                      ) : 'TBA'}
                    </div>
                  </div>

                  <div style={{ padding: '2rem' }}>
                    <h3 className="text-main" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{event.name}</h3>
                    <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>📍 {event.venue}</p>
                    <p className="text-dim" style={{ fontSize: '0.95rem', marginBottom: '1.5rem', lineBreak: 'anywhere' }}>{(event.description || '').substring(0, 100)}...</p>

                    <div className="event-details">
                      <div className="cyber-label" style={{ fontSize: '0.7rem', marginBottom: '0.5rem' }}>Availability</div>
                      <div style={{ background: 'var(--bg-deep)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                        <div
                          style={{
                            width: `${event.capacity > 0 ? (event.ticketsSold / event.capacity) * 100 : 0}%`,
                            height: '100%',
                            background: 'var(--accent-cyan)',
                            boxShadow: '0 0 10px var(--accent-cyan)'
                          }}
                        ></div>
                      </div>
                      <div className="flex-between">
                        <span className="text-dim" style={{ fontSize: '0.8rem' }}>{event.capacity - event.ticketsSold} / {event.capacity} left</span>
                        <span className="text-glow" style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>Tickets Available</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
};

export default function HomePageWrapper(props) {
  return (
    <>
      <HomePage {...props} />
    </>
  );
}
