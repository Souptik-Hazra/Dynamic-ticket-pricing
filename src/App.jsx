import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import HomePage from './components/HomePage';
import Login from './components/Login';
import Signup from './components/Signup';
import AdminDashboard from './components/AdminDashboard';
import EventList from './components/EventList';
import Analytics from './components/Analytics';
import TicketPurchase from './components/TicketPurchase';
import Subscription from './components/Subscription';
import { API_URL } from './config/api';
import { getPlanLabel } from './utils/subscriptionPlans';
import './App.css';
import './components/NavBadge.css';
import UserProfile from "./components/UserProfile.jsx";

// Navbar Component
function Navbar() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="top-navigation">
      <div className="nav-container">
        <div className="nav-brand" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
          <span className="brand-icon">🎫</span>
          <span className="brand-name">FanFeverTickets</span>
        </div>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
          <Link to="/events" className={location.pathname === '/events' ? 'active' : ''}>Events</Link>
          
          {isAuthenticated && isAdmin() && (
            <>
              <Link to="/analytics" className={location.pathname === '/analytics' ? 'active' : ''}>Analytics</Link>
              <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Admin</Link>
            </>
          )}
        </div>
        
        <div className="nav-actions">
          {!isAuthenticated ? (
            <div className="auth-buttons">
              <button 
                className="nav-login-btn"
                onClick={() => navigate('/login')}
              >
                Login
              </button>
              <button 
                className="nav-signup-btn"
                onClick={() => navigate('/signup')}
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="user-menu">
              <span className="user-name">Hello, {user?.name?.split(' ')[0]}</span>
              
              {user?.subscription && user.subscription.isActive && user.subscription.plan !== 'none' && (
                <span className="sub-badge">
                  {getPlanLabel(user.subscription.plan)}
                </span>
              )}
              
              <div className="user-actions">
                {!isAdmin() && (
                   <button onClick={() => navigate('/subscription')} className="nav-btn-icon" title="Membership">⭐</button>
                )}
                <button onClick={() => navigate('/profile')} className="nav-btn-icon" title="Profile">👤</button>
                <button onClick={handleLogout} className="nav-logout-btn">Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// Protected Route Wrapper
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  
  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  if (adminOnly && !isAdmin()) return <Navigate to="/" replace />;
  
  return children;
};

// Main Content
function AppContent() {
  const { loading } = useAuth();
  
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/events" element={<EventList />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Protected Routes */}
            <Route path="/admin" element={
              <ProtectedRoute adminOnly={true}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/analytics" element={
              <ProtectedRoute adminOnly={true}>
                <Analytics />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            } />
            
            <Route path="/subscription" element={
              <ProtectedRoute>
                <Subscription />
              </ProtectedRoute>
            } />
            
            <Route path="/purchase/:eventId" element={
              <ProtectedRoute>
                <TicketPurchase />
              </ProtectedRoute>
            } />
            
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
