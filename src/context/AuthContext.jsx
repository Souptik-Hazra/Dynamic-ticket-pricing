import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { buildUrl, ENDPOINTS } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// ── Axios defaults ────────────────────────────────────────────────────────
axios.defaults.withCredentials = false; // We use Bearer tokens, not cookies

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef(null);

  // ── Token refresh ─────────────────────────────────────────────────────────
  // JWT is set to 7d — schedule silent refresh at ~day 6 (so user never gets logged out)
  const scheduleTokenRefresh = useCallback((token) => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    if (!token) return;

    // Refresh after 6 days (token expires in 7 days)
    const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await axios.post(
          buildUrl(ENDPOINTS.REFRESH_TOKEN),
          {},
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          setAxiosToken(response.data.token);
          if (response.data.user) setUser(response.data.user);
          scheduleTokenRefresh(response.data.token); // schedule next refresh
        }
      } catch {
        // Refresh failed — silently log out (token likely expired)
        performLogout();
      }
    }, SIX_DAYS_MS);
  }, []); // eslint-disable-line

  const setAxiosToken = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // ── Load user on mount ────────────────────────────────────────────────────
  useEffect(() => {
    loadUser();
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []); // eslint-disable-line

  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setAxiosToken(token);
      const response = await axios.get(buildUrl(ENDPOINTS.ME));
      setUser(response.data.user);
      scheduleTokenRefresh(token);
    } catch (error) {
      // Token is invalid/expired — clear it
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        setAxiosToken(null);
        setUser(null);
      } else {
        // Network error — keep token, try again later
        console.warn('Could not verify session (network?):', error.message);
        setUser(null); // Safe default
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Signup ────────────────────────────────────────────────────────────────
  const signup = async (name, email, password, role = 'user') => {
    try {
      const response = await axios.post(buildUrl(ENDPOINTS.SIGNUP), { name, email, password, role });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setAxiosToken(response.data.token);
        scheduleTokenRefresh(response.data.token);
      }
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Signup failed. Please try again.',
      };
    }
  };

  // ── Signin ────────────────────────────────────────────────────────────────
  const signin = async (email, password) => {
    try {
      const response = await axios.post(buildUrl(ENDPOINTS.LOGIN), { email, password });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setAxiosToken(response.data.token);
        scheduleTokenRefresh(response.data.token);
      }
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed. Please check your credentials.',
      };
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const performLogout = () => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    localStorage.removeItem('token');
    setAxiosToken(null);
    setUser(null);
  };

  const logout = async () => {
    try {
      // Fire-and-forget logout call (server-side is stateless, just for logs)
      await axios.post(buildUrl(ENDPOINTS.LOGOUT));
    } catch {
      // Ignore — we always log out client-side regardless
    }
    performLogout();
  };

  // ── Update user profile ────────────────────────────────────────────────────
  const updateUser = async (profileData) => {
    const token = localStorage.getItem('token');
    const response = await axios.put(
      buildUrl(ENDPOINTS.UPDATE_PROFILE),
      profileData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.data.user) setUser(response.data.user);
    return response.data.user;
    // Errors propagate to caller — let component handle them
  };

  // ── Refresh user from server (call after subscription change etc.) ─────────
  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await axios.get(
        buildUrl(ENDPOINTS.ME),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.user) setUser(response.data.user);
    } catch {
      // Silently ignore — stale data is better than crashing
    }
  };

  const isAdmin = () => user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signup,
      signin,
      logout,
      isAdmin,
      isAuthenticated: !!user,
      updateUser,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
