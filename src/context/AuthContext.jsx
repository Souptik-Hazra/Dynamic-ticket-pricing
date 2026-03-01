import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';

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

  // Configure axios for sessions
  useEffect(() => {
    axios.defaults.withCredentials = true;
    // Delay loadUser to prevent double-call in StrictMode and allow initial render
    const loadTimer = setTimeout(loadUser, 100);
    return () => clearTimeout(loadTimer);
  }, []);

  // Load user data
  const loadUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        timeout: 5000  // 5 second timeout
      });
      setUser(response.data.data || response.data.user);
    } catch (error) {
      // Silently fail - backend not running or session expired
      // Don't log anything to keep console clean during dev
      setUser(null);
    }
  };

  // Signup
  const signup = async (name, email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/signup`, { name, email, password });
      setUser(response.data.data || response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Signup failed'
      };
    }
  };

  // Signin
  const signin = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/signin`, { email, password });
      setUser(response.data.data || response.data.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Login failed'
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (err) {
      // Silently fail logout errors
    }
    setUser(null);
  };

  // Update profile
  const updateProfile = async (profileData) => {
    const response = await axios.put(`${API_URL}/auth/update-profile`, profileData);
    const userData = response.data.data || response.data.user;
    setUser(userData);
    return userData;
  };

  const value = {
    user,
    isAuthenticated: !!user,
    signup,
    signin,
    logout,
    loadUser,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
