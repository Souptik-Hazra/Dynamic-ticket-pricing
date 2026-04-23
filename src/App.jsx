import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import api from './api/client';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import UserProfile from "./components/UserProfile.jsx";
import Notifications from "./components/Notifications.jsx";
import OrganizerDashboard from "./components/OrganizerDashboard.jsx";
import Scanner from "./components/Scanner.jsx";
import { useEvents, useUpdatePrice } from './hooks/useEvents';

function AppContent() {
  const { user, loading: authLoading, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: events = [], isLoading: loading, refetch: fetchEvents } = useEvents();
  const updatePriceMutation = useUpdatePrice();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // We no longer need manual fetchEvents and useEffect for it as useEvents handles it

  const handleUpdatePrice = async (eventId) => {
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
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    navigate(`/purchase/${event._id}`);
  };

  const handleNavigate = (page, data = null) => {
    if (data) setSelectedEvent(data);
    navigate(page === 'home' ? '/' : `/${page}`);
  };

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
            />
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
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
