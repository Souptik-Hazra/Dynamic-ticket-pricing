import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL, ENDPOINTS } from '../config/api';

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
  // NOTE: Using localStorage for token storage. For higher security environments,
  // consider httpOnly cookies, but this requires backend cookie handling.
  // Current approach is acceptable for this application's security requirements.
  const [token, setToken] = useState(localStorage.getItem('token'));
  const refreshTimeoutRef = useRef(null);

  // Schedule token refresh before expiration
  const scheduleTokenRefresh = useCallback(() => {
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return;
    
    // Refresh 5 minutes before expiration (token expires in 1h, so refresh at ~55min)
    const refreshTime = 55 * 60 * 1000; // 55 minutes
    
    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await axios.post(`${API_URL}${ENDPOINTS.REFRESH_TOKEN}`, {
          refreshToken
        });
        
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
          setToken(response.data.token);
          setUser(response.data.user);
          
          // Schedule next refresh
          scheduleTokenRefresh();
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails, log user out
        logout();
      }
    }, refreshTime);
  }, []);

  // Set axios default header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      loadUser();
      scheduleTokenRefresh();
    } else {
      setLoading(false);
    }
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [token, scheduleTokenRefresh]);

  // Load user data
  const loadUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      setUser(response.data.user);
    } catch (error) {
      console.error('Load user error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Signup
  const signup = async (name, email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/signup`, {
        name,
        email,
        password
      });

      const { token, refreshToken, user } = response.data;
      
      localStorage.setItem('token', token);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setToken(token);
      setUser(user);

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
      const response = await axios.post(`${API_URL}/auth/signin`, {
        email,
        password
      });

      const { token, refreshToken, user } = response.data;
      
      localStorage.setItem('token', token);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setToken(token);
      setUser(user);

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
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  // Check if user is admin
  const isAdmin = () => {
    return user?.role === 'admin';
  };


  // Update user profile
  const updateUser = async (profileData) => {
    try {
      const response = await axios.put(`${API_URL}/auth/update-profile`, profileData);
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
