import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
import { buildUrl, ENDPOINTS } from './config/api';
import './App.css';
import './components/NavBadge.css';
import UserProfile from "./components/UserProfile.jsx";
import Notifications from "./components/Notifications.jsx";

function AppContent() {
  const { user, loading: authLoading, logout, isAuthenticated, isAdmin } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' or 'signup'
  const [view, setView] = useState('home'); // Start with home page
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Redirect to home page after logout
  useEffect(() => {
    if (
      !isAuthenticated &&
      view !== 'home' &&
      view !== 'login' &&
      view !== 'signup' &&
      view !== 'events' &&
      view !== 'purchase'
    ) {
      setView('home');
    }
  }, [isAuthenticated, view]);
  // Redirect to events page after login
  useEffect(() => {
    if (isAuthenticated && view === 'login') {
      setView('events');
    }
  }, [isAuthenticated, view]);

  // Close mobile menu when view changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [view]);

  // Fetch events on initial load (public access)
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(buildUrl(ENDPOINTS.EVENTS));
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async (eventId) => {
    try {
      const response = await axios.get(buildUrl(`/events/${eventId}/dynamic-prices`));
      const prices = response.data.prices;
      const occupancy = response.data.occupancyRate;
      const priceText = prices
        ? Object.entries(prices).map(([cat, price]) => `${cat}: ₹${price}`).join(' | ')
        : 'N/A';
      alert(`Dynamic Prices (${occupancy}% occupancy):\n${priceText}`);
      fetchEvents();
    } catch (error) {
      console.error('Error fetching dynamic prices:', error);
      alert('Failed to fetch dynamic prices. Make sure the organizer service is running.');
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setView('purchase');
  };

  // Show loading spinner while checking auth
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

  const handleNavigate = (page, data = null) => {
    setView(page);
    if (data) setSelectedEvent(data);
  };

  // Render navigation bar
  const renderNavigation = () => (
    <nav className="top-navigation">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => setView('home')}>
          <span className="brand-icon">🎫</span>
          <span className="brand-name">FanFeverTickets</span>
        </div>
        
        <button 
          className="mobile-menu-toggle" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
        
        <div className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <button onClick={() => setView('home')} className={view === 'home' ? 'active' : ''}>
            Home
          </button>
          <button onClick={() => setView('events')} className={view === 'events' ? 'active' : ''}>
            Events
          </button>
          {isAuthenticated && isAdmin() && (
            <>
              <button onClick={() => setView('analytics')} className={view === 'analytics' ? 'active' : ''}>
                Analytics
              </button>
              <button onClick={() => setView('admin')} className={view === 'admin' ? 'active' : ''}>
                Admin
              </button>
            </>
          )}
          
          {/* Mobile-only auth buttons */}
          <div className="mobile-auth-buttons">
            {!isAuthenticated ? (
              <>
                <button onClick={() => { setAuthView('login'); setView('login'); }} className="nav-login-btn">
                  Login
                </button>
                <button onClick={() => { setAuthView('signup'); setView('signup'); }} className="nav-signup-btn">
                  Sign Up
                </button>
              </>
            ) : (
              <>
                <span className="mobile-user-name">{user?.name}</span>
                {user?.subscription && user.subscription.isActive && user.subscription.plan !== 'none' && (
                  <span className="nav-subscription-badge">
                    {user.subscription.plan === '7_days' ? 'WEEKLY' :
                     user.subscription.plan === '30_days' ? 'MONTHLY' :
                     user.subscription.plan === '3_months' ? 'QUARTERLY' :
                     user.subscription.plan === '6_months' ? 'BIANNUAL' :
                     user.subscription.plan === '1_year' ? 'ANNUAL' : 'MEMBER'}
                  </span>
                )}
                {!isAdmin() && (
                  <button onClick={() => setView('subscription')} className="nav-profile-btn">Membership</button>
                )}
                <button onClick={() => setView('notifications')} className="nav-profile-btn">🔔</button>
                <button onClick={() => setView('profile')} className="nav-profile-btn">Profile</button>
                <button onClick={logout} className="nav-logout-btn">Logout</button>
              </>
            )}
          </div>
        </div>
        
        <div className="nav-actions">
          {!isAuthenticated ? (
            <>
              <button onClick={() => { setAuthView('login'); setView('login'); }} className="nav-login-btn">
                Login
              </button>
              <button onClick={() => { setAuthView('signup'); setView('signup'); }} className="nav-signup-btn">
                Sign Up
              </button>
            </>
          ) : (
            <div className="nav-user">
              <span className="user-name">{user?.name}</span>
               {user?.subscription && user.subscription.isActive && user.subscription.plan !== 'none' && (
                  <span className="nav-subscription-badge">
                      {user.subscription.plan === '7_days' ? 'WEEKLY' :
                       user.subscription.plan === '30_days' ? 'MONTHLY' :
                       user.subscription.plan === '3_months' ? 'QUARTERLY' :
                       user.subscription.plan === '6_months' ? 'BIANNUAL' :
                       user.subscription.plan === '1_year' ? 'ANNUAL' : 'MEMBER'}
                  </span>
               )}
              {!isAdmin() && (
                <button onClick={() => setView('subscription')} className="nav-profile-btn">Membership</button>
              )}
              <button onClick={() => setView('notifications')} className="nav-profile-btn" title="Notifications">🔔</button>
              <button onClick={() => setView('profile')} className="nav-profile-btn">Profile</button>
              <button onClick={logout} className="nav-logout-btn">Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  // Show login/signup pages
  if (view === 'login') {
    return (
      <div className="App">
        {renderNavigation()}
        <Login onSwitchToSignup={() => { setAuthView('signup'); setView('signup'); }} />
      </div>
    );
  }

  if (view === 'signup') {
    return (
      <div className="App">
        {renderNavigation()}
        <Signup onSwitchToLogin={() => { setAuthView('login'); setView('login'); }} />
      </div>
    );
  }

  // Main application interface
  return (
    <div className="App">
      {renderNavigation()}

      {view === 'home' && (
        <HomePage onNavigate={handleNavigate} />
      )}

      {view === 'events' && (
        <div className="main-content">
          {loading && <div className="loading">Loading...</div>}
          <EventList 
            events={events}
            onSelectEvent={handleSelectEvent}
            onUpdatePrice={handleUpdatePrice}
          />
        </div>
      )}

      {view === 'analytics' && isAuthenticated && (
        <Analytics />
      )}

      {view === 'admin' && isAuthenticated && isAdmin() && (
        <AdminDashboard />
      )}

      {view === 'purchase' && selectedEvent && (
        <TicketPurchase 
          event={selectedEvent}
          onBack={() => setView('events')}
          onSuccess={() => {
            fetchEvents();
            setView('events');
          }}
        />
      )}

      {view === 'notifications' && isAuthenticated && (
        <Notifications />
      )}

      {view === 'profile' && isAuthenticated && (
        <UserProfile />
      )}

      {view === 'subscription' && isAuthenticated && (
        <Subscription />
      )}
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
