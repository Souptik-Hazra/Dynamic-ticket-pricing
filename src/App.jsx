import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BehavioralProvider } from './context/BehavioralContext';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './components/HomePage';
import Login from './components/Login';
import Signup from './components/Signup';
import AdminDashboard from './components/AdminDashboard';
import EventList from './components/EventList';
import Analytics from './components/Analytics';
import TicketPurchase from './components/TicketPurchase';
import Subscription from './components/Subscription';
import { ENDPOINTS } from './config/api';
import UserProfile from "./components/UserProfile";
import Notifications from "./components/Notifications";
import OrganizerDashboard from "./components/OrganizerDashboard";
import Scanner from "./components/Scanner";
import { useEvents, useUpdatePrice } from './hooks/useEvents';

function AppContent() {
  const { user, loading: authLoading, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [eventsPage, setEventsPage] = React.useState(1);
  const { data: eventsData = { items: [] }, isLoading: loading, refetch: fetchEvents } = useEvents(eventsPage, 20);
  const events = eventsData.items || [];
  const updatePriceMutation = useUpdatePrice();
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Handle auth redirects
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      if (user?.role === 'staff' || user?.role === 'organizer' || user?.role === 'admin') {
        navigate('/scanner');
      } else {
        navigate('/events');
      }
    }
  }, [isAuthenticated, location.pathname, user, navigate]);

  const handleUpdatePrice = useCallback(async (eventId) => {
    try {
      const data = await updatePriceMutation.mutateAsync(eventId);
      const prices = data.prices;
      const occupancy = data.occupancyRate;
      const priceText = prices
        ? Object.entries(prices).map(([cat, price]) => `${cat}: ₹${price}`).join(' | ')
        : 'N/A';
      alert(`Dynamic Prices (${occupancy}% occupancy):\n${priceText}`);
    } catch (error) {
      console.error('Error fetching dynamic prices:', error);
      alert('Failed to fetch dynamic prices. Make sure the organizer service is running.');
    }
  }, [updatePriceMutation]);

  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    navigate(`/purchase/${event._id}`);
  }, [navigate]);

  const handleNavigate = useCallback((page, data = null) => {
    if (data) setSelectedEvent(data);
    navigate(page === 'home' ? '/' : `/${page}`);
  }, [navigate]);

  const renderNavigation = () => (
    <nav className="cyber-nav">
      <div className="cyber-container flex-between">
        <div className="flex-center" style={{ gap: '1rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <span style={{ fontSize: '1.8rem' }}>🎫</span>
          <span className="text-gradient" style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '1px' }}>FANFEVER</span>
        </div>

        <div className="flex-center" style={{ gap: '0.5rem' }}>
          <button onClick={() => navigate('/')} className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>Home</button>
          <button onClick={() => navigate('/events')} className={`nav-link ${location.pathname === '/events' ? 'active' : ''}`}>Events</button>
          
          {isAuthenticated && (
            <>
              {(isAdmin() || user?.role === 'organizer' || user?.role === 'staff') && (
                <button onClick={() => navigate('/scanner')} className={`nav-link ${location.pathname === '/scanner' ? 'active' : ''}`}>🛡️ Scanner</button>
              )}
              {isAdmin() && (
                <>
                  <button onClick={() => navigate('/analytics')} className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`}>Analytics</button>
                  <button onClick={() => navigate('/admin')} className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}>Admin</button>
                </>
              )}
              {user?.role === 'organizer' && (
                <button onClick={() => navigate('/organizer')} className={`nav-link ${location.pathname === '/organizer' ? 'active' : ''}`}>Dashboard</button>
              )}
            </>
          )}
        </div>

        <div className="flex-center" style={{ gap: '1rem' }}>
          {!isAuthenticated ? (
            <>
              <button onClick={() => navigate('/login')} className="cyber-btn btn-outline" style={{ padding: '0.5rem 1.2rem', fontSize: '0.8rem' }}>Login</button>
              <button onClick={() => navigate('/signup')} className="cyber-btn btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.8rem' }}>Sign Up</button>
            </>
          ) : (
            <div className="flex-center" style={{ gap: '1rem' }}>
              <div className="flex-column" style={{ alignItems: 'flex-end', lineHeight: '1' }}>
                <span className="text-main" style={{ fontSize: '0.85rem', fontWeight: '700' }}>{user?.name}</span>
                <span className="text-dim" style={{ fontSize: '0.65rem' }}>{user?.role?.toUpperCase()}</span>
              </div>
              <button onClick={() => navigate('/notifications')} className="cyber-btn btn-outline" style={{ padding: '0.5rem', borderRadius: '50%' }} title="Notifications">🔔</button>
              <button onClick={() => navigate('/profile')} className="cyber-btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>Profile</button>
              <button onClick={logout} className="cyber-btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  if (authLoading) {
    return (
      <div className="App">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {renderNavigation()}
      <Routes>
        <Route path="/" element={<HomePage onNavigate={handleNavigate} />} />
        <Route path="/login" element={<Login onSwitchToSignup={() => navigate('/signup')} />} />
        <Route path="/signup" element={<Signup onSwitchToLogin={() => navigate('/login')} />} />
        
        <Route path="/events" element={
          <div className="main-content">
            {loading && <div className="loading">Loading...</div>}
            <EventList
              events={events}
              onSelectEvent={handleSelectEvent}
              onUpdatePrice={handleUpdatePrice}
              onRefresh={() => fetchEvents()}
            />

            <div className="flex-center" style={{ gap: '1rem', marginTop: '2.5rem', flexWrap: 'wrap' }}>
              <button 
                className="cyber-btn btn-outline" 
                onClick={() => setEventsPage(Math.max(1, eventsPage - 1))} 
                disabled={eventsPage <= 1}
                style={{ minWidth: '100px' }}
              >
                ← PREV
              </button>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {Array.from({ length: eventsData.totalPages || 1 }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === eventsData.totalPages || Math.abs(p - eventsPage) <= 1)
                  .map((p, index, arr) => (
                    <React.Fragment key={p}>
                      {index > 0 && arr[index - 1] !== p - 1 && <span style={{ alignSelf: 'center' }}>...</span>}
                      <button
                        className={`cyber-btn ${eventsPage === p ? 'btn-primary' : 'btn-outline'}`}
                        style={{ minWidth: '45px', padding: '0.5rem' }}
                        onClick={() => setEventsPage(p)}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))
                }
              </div>

              <button 
                className="cyber-btn btn-outline" 
                onClick={() => setEventsPage(Math.min(eventsData.totalPages || 1, eventsPage + 1))} 
                disabled={eventsPage >= (eventsData.totalPages || 1)}
                style={{ minWidth: '100px' }}
              >
                NEXT →
              </button>
            </div>
            
            <div className="flex-center" style={{ marginTop: '0.5rem' }}>
              <span className="text-dim" style={{ fontSize: '0.8rem' }}>
                SHOWING PAGE {eventsData.page} OF {eventsData.totalPages} ({eventsData.total} TOTAL EVENTS)
              </span>
            </div>

            {/* Creative Decorative Section */}
            <div className="flex-column flex-center" style={{ marginTop: '5rem', position: 'relative', width: '100%', overflow: 'hidden' }}>
              <div className="flex-center" style={{ gap: '2rem', marginBottom: '2rem' }}>
                <div style={{ width: '100px', height: '1px', background: 'linear-gradient(90deg, transparent, var(--accent-cyan))' }} />
                <span className="text-glow" style={{ fontSize: '0.7rem', fontWeight: '900', letterSpacing: '4px', color: 'var(--text-dim)' }}>SYSTEM ANALYTICS</span>
                <div style={{ width: '100px', height: '1px', background: 'linear-gradient(270deg, transparent, var(--accent-cyan))' }} />
              </div>
              
              <svg width="600" height="120" viewBox="0 0 600 120" style={{ filter: 'drop-shadow(0 0 10px var(--accent-cyan))' }}>
                <defs>
                  <linearGradient id="hologram-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="50%" stopColor="var(--accent-cyan)" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                  <mask id="pulse-mask">
                    <rect x="0" y="0" width="600" height="120" fill="white" />
                  </mask>
                </defs>
                
                {/* Background Grid Lines */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <line 
                    key={i}
                    x1={i * 50} y1="0" x2={i * 50} y2="120" 
                    stroke="var(--bg-accent)" 
                    strokeWidth="0.5" 
                  />
                ))}
                {Array.from({ length: 4 }).map((_, i) => (
                  <line 
                    key={i}
                    x1="0" y1={i * 30} x2="600" y2={i * 30} 
                    stroke="var(--bg-accent)" 
                    strokeWidth="0.5" 
                  />
                ))}

                {/* Pulsing Waveform */}
                <path 
                  d="M0,60 L50,60 L70,20 L90,100 L110,60 L150,60 L170,40 L190,80 L210,60 L300,60 L320,10 L340,110 L360,60 L400,60 L420,30 L440,90 L460,60 L600,60" 
                  fill="none" 
                  stroke="url(#hologram-grad)" 
                  strokeWidth="2"
                  strokeDasharray="1000"
                  strokeDashoffset="1000"
                >
                  <animate 
                    attributeName="stroke-dashoffset" 
                    from="1000" to="-1000" 
                    dur="4s" 
                    repeatCount="indefinite" 
                  />
                </path>

                {/* Animated Particles */}
                {Array.from({ length: 5 }).map((_, i) => (
                  <circle key={i} r="2" fill="var(--accent-cyan)">
                    <animateMotion 
                      path="M0,60 L50,60 L70,20 L90,100 L110,60 L150,60 L170,40 L190,80 L210,60 L300,60 L320,10 L340,110 L360,60 L400,60 L420,30 L440,90 L460,60 L600,60"
                      dur={`${3 + i}s`}
                      repeatCount="indefinite"
                      begin={`${i * 0.5}s`}
                    />
                    <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
                  </circle>
                ))}

                <text x="50%" y="115" textAnchor="middle" fill="var(--accent-cyan)" fontSize="8" style={{ opacity: 0.5, fontWeight: 'bold' }}>
                  LATENCY: 14MS | THROUGHPUT: 1.2 GBPS | NODES: 852
                </text>
              </svg>

              <div className="cyber-pulse" style={{ marginTop: '1rem', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }} />
            </div>
          </div>
        } />

        {/* Protected Routes */}
        <Route path="/analytics" element={isAuthenticated ? <Analytics /> : <Navigate to="/login" />} />
        <Route path="/admin" element={isAuthenticated && isAdmin() ? <AdminDashboard /> : <Navigate to="/login" />} />
        <Route path="/organizer" element={isAuthenticated && user?.role === 'organizer' ? <OrganizerDashboard /> : <Navigate to="/login" />} />
        
        <Route path="/purchase/:eventId" element={
          selectedEvent ? (
            <TicketPurchase
              event={selectedEvent}
              onBack={() => navigate('/events')}
              onSuccess={() => {
                fetchEvents();
                navigate('/events');
              }}
            />
          ) : <Navigate to="/events" />
        } />

        <Route path="/notifications" element={isAuthenticated ? <Notifications /> : <Navigate to="/login" />} />
        <Route path="/profile" element={isAuthenticated ? <UserProfile /> : <Navigate to="/login" />} />
        <Route path="/subscription" element={isAuthenticated ? <Subscription /> : <Navigate to="/login" />} />
        <Route path="/scanner" element={
          isAuthenticated && (user?.role === 'organizer' || user?.role === 'staff' || isAdmin()) 
            ? <Scanner /> 
            : <Navigate to="/login" />
        } />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BehavioralProvider>
          <AppContent />
        </BehavioralProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
