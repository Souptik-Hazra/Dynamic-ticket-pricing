import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL, ENDPOINTS, buildUrl } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef(null);

  // Schedule token refresh before expiration
  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;

    // Refresh 5 minutes before expiration (token expires in 1h, so refresh at ~55min)
    const refreshTime = 55 * 60 * 1000;

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await axios.post(buildUrl(ENDPOINTS.REFRESH_TOKEN), {
          refreshToken
        });

        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
          if (response.data.user) setUser(response.data.user);

          // Schedule next refresh
          scheduleTokenRefresh();
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        logout();
      }
    }, refreshTime);
  }, []);

  // Set axios defaults and load user on mount
  useEffect(() => {
    axios.defaults.withCredentials = true;
    loadUser();
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Load user data from stored token
  const loadUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.get(buildUrl(ENDPOINTS.ME));
      setUser(response.data.user);
    } catch (error) {
      console.error('Load user error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Signup
  const signup = async (name, email, password) => {
    try {
      const response = await axios.post(buildUrl(ENDPOINTS.SIGNUP), {
        name,
        email,
        password
      }, { withCredentials: true });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Signup failed. Please try again.'
      };
    }
  };

  // Signin
  const signin = async (email, password) => {
    try {
      const response = await axios.post(buildUrl(ENDPOINTS.LOGIN), {
        email,
        password
      }, { withCredentials: true });

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      console.error('Signin error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed. Please try again.'
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await axios.post(buildUrl('/auth/logout'), {}, { withCredentials: true });
    } catch (e) {
      // Ignore logout endpoint errors
    }
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // Check if user is admin
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  // Update user profile
  const updateUser = async (profileData) => {
    try {
      const response = await axios.put(buildUrl(ENDPOINTS.UPDATE_PROFILE), profileData);
      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signup,
    signin,
    logout,
    isAdmin,
    isAuthenticated: !!user,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
