import React, { useState } from 'react';
import { signupSchema } from '../utils/validationSchemas';
import { useAuth } from '../context/AuthContext';
import './Login.css';

function Signup({ onSwitchToLogin }) {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    city: '',
    plan: 'none'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await signupSchema.validate(formData, { abortEarly: false });
    } catch (validationError) {
      setError(validationError.errors[0]);
      return;
    }

    setLoading(true);

    const result = await signup(formData.name, formData.email, formData.password, formData.city, formData.plan);

    if (result.success) {
      // Navigation will be handled by App.jsx based on auth state
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>🎫 Create Account</h2>
          <p>Join Dynamic Ticket Pricing Today</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form modern-signup-form">
          <div className="form-group modern-form-group">
            <label htmlFor="name"><span role="img" aria-label="user">👤</span> Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              required
              disabled={loading}
              autoComplete="name"
              className="modern-input"
            />
          </div>

          <div className="form-group modern-form-group">
            <label htmlFor="email"><span role="img" aria-label="email">📧</span> Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              disabled={loading}
              autoComplete="email"
              className="modern-input"
            />
          </div>

          <div className="form-group modern-form-group">
            <label htmlFor="password"><span role="img" aria-label="lock">🔒</span> Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="At least 8 characters, letters & numbers"
              required
              disabled={loading}
              minLength="8"
              autoComplete="new-password"
              className="modern-input"
            />
            <small className="modern-helper">Must be at least 8 characters, include letters and numbers</small>
          </div>

          <div className="form-group modern-form-group">
            <label htmlFor="confirmPassword"><span role="img" aria-label="lock">🔒</span> Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              required
              disabled={loading}
              minLength="8"
              autoComplete="new-password"
              className="modern-input"
            />
          </div>

          <div className="form-group modern-form-group">
            <label htmlFor="city"><span role="img" aria-label="city">🏙️</span> City</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g. Mumbai, Delhi, Bangalore"
              required
              disabled={loading}
              className="modern-input"
            />
          </div>

          <div className="form-group modern-form-group">
            <label htmlFor="plan"><span role="img" aria-label="plan">💳</span> Subscription Plan</label>
            <select
              id="plan"
              name="plan"
              value={formData.plan}
              onChange={handleChange}
              disabled={loading}
              className="modern-input"
            >
              <option value="none">None</option>
              <option value="7_days">7 Days</option>
              <option value="30_days">30 Days</option>
              <option value="3_months">3 Months</option>
              <option value="6_months">6 Months</option>
              <option value="1_year">1 Year</option>
            </select>
            <small className="modern-helper">Choose a plan now or later</small>
          </div>

          <button type="submit" className="auth-submit-btn modern-btn-send" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <button 
              className="link-btn" 
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
