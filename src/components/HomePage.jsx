import { useState } from 'react';
import { useEvents } from '../hooks/useEvents';

const HomePage = ({ onNavigate }) => {
  const [page] = useState(1);
  const [limit] = useState(6);
  const { data: eventsData = { items: [] }, isLoading: loading } = useEvents(page, limit);
  const events = eventsData.items || [];
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
      <section className="hero-section cyber-section animate-fade-up" style={{ padding: '2.5rem 0' }}>
        <div className="cyber-container flex-column flex-center" style={{ textAlign: 'center' }}>
          <div className="hero-content flex-column flex-center">
            <h1 className="title-main text-gradient" style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>The Future of Event Ticketing</h1>
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

                  <div style={{ padding: '1.25rem' }}>
                    <h3 className="text-main" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{event.name}</h3>
                    <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>📍 {event.venue}</p>
                    <p className="text-dim" style={{ fontSize: '0.95rem', marginBottom: '1.25rem', lineBreak: 'anywhere' }}>{(event.description || '').substring(0, 100)}...</p>

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

      {/* Creative Footer Section */}
      <section className="creative-footer cyber-section" style={{ borderTop: '1px solid var(--border-dim)', background: 'rgba(5, 9, 20, 0.4)', marginTop: '4rem' }}>
        <div className="cyber-container flex-column flex-center">
          <div className="flex-column flex-center" style={{ marginBottom: '3rem', textAlign: 'center' }}>
            <h2 className="title-sub text-gradient" style={{ fontWeight: '900', letterSpacing: '2px' }}>GLOBAL EVENT PULSE</h2>
            <p className="text-dim" style={{ maxWidth: '600px', fontSize: '0.9rem' }}>
              Our neural network is currently scanning 1,429 sectors across the globe to bring you the most exclusive and fairly priced experiences.
            </p>
          </div>

          <div style={{ position: 'relative', width: '100%', maxWidth: '800px', height: '300px', background: 'radial-gradient(circle at 50% 50%, rgba(79, 172, 254, 0.05) 0%, transparent 70%)', borderRadius: '40px', padding: '20px' }}>
            <svg width="100%" height="100%" viewBox="0 0 800 300">
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--bg-accent)" />
                  <stop offset="50%" stopColor="var(--accent-cyan)" />
                  <stop offset="100%" stopColor="var(--bg-accent)" />
                </linearGradient>
              </defs>
              
              {/* Connection Lines */}
              <g stroke="var(--bg-accent)" strokeWidth="1" opacity="0.4">
                <line x1="100" y1="50" x2="250" y2="150" />
                <line x1="250" y1="150" x2="150" y2="250" />
                <line x1="150" y1="250" x2="400" y2="100" />
                <line x1="400" y1="100" x2="600" y2="200" />
                <line x1="600" y1="200" x2="700" y2="50" />
                <line x1="700" y1="50" x2="500" y2="150" />
                <line x1="500" y1="150" x2="400" y2="100" />
              </g>

              {/* Pulsing Nodes */}
              {[
                { x: 100, y: 50, label: 'LONDON' },
                { x: 250, y: 150, label: 'TOKYO' },
                { x: 150, y: 250, label: 'SYDNEY' },
                { x: 400, y: 100, label: 'NEW YORK' },
                { x: 600, y: 200, label: 'PARIS' },
                { x: 700, y: 50, label: 'BERLIN' },
                { x: 500, y: 150, label: 'DUBAI' },
              ].map((node, i) => (
                <g key={i}>
                  <circle cx={node.x} cy={node.y} r="5" fill="var(--accent-cyan)" filter="url(#glow)">
                    <animate attributeName="r" values="4;7;4" dur={`${2 + i % 3}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;1;0.5" dur={`${2 + i % 3}s`} repeatCount="indefinite" />
                  </circle>
                  <circle cx={node.x} cy={node.y} r="12" fill="none" stroke="var(--accent-cyan)" strokeWidth="0.5" opacity="0.3">
                    <animate attributeName="r" values="8;20;8" dur={`${3 + i % 2}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0;0.3" dur={`${3 + i % 2}s`} repeatCount="indefinite" />
                  </circle>
                  <text x={node.x + 15} y={node.y + 5} fill="var(--text-dim)" fontSize="9" style={{ fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="flex-center" style={{ gap: '5rem', marginTop: '4rem', flexWrap: 'wrap' }}>
            <div className="flex-column flex-center">
              <span className="title-main text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.2rem', margin: 0 }}>14K+</span>
              <span className="cyber-label" style={{ fontSize: '0.75rem', letterSpacing: '2px' }}>TICKETS SECURED</span>
            </div>
            <div className="flex-column flex-center">
              <span className="title-main text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.2rem', margin: 0 }}>0.02S</span>
              <span className="cyber-label" style={{ fontSize: '0.75rem', letterSpacing: '2px' }}>AI PRICE SYNC</span>
            </div>
            <div className="flex-column flex-center">
              <span className="title-main text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.2rem', margin: 0 }}>99.9%</span>
              <span className="cyber-label" style={{ fontSize: '0.75rem', letterSpacing: '2px' }}>NETWORK UPTIME</span>
            </div>
          </div>
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
