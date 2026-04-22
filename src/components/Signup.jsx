import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Signup({ onSwitchToLogin }) {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
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

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await signup(formData.name, formData.email, formData.password, formData.role);

    if (result.success) {
      // Navigation will be handled by App.jsx based on auth state
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="flex-center" style={{ minHeight: '80vh', padding: '2rem 0' }}>
      <div className="cyber-card animate-fade-up" style={{ maxWidth: '500px', width: '100%', padding: '3rem' }}>
        <div className="flex-column flex-center" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <h2 className="title-main text-gradient" style={{ margin: 0, fontSize: '2.5rem' }}>🎫 New Identity</h2>
          <p className="text-muted">Initialize your presence in the ecosystem</p>
        </div>

        {error && (
          <div className="cyber-badge badge-danger" style={{ width: '100%', padding: '1rem', marginBottom: '2rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-column" style={{ gap: '1.2rem' }}>
          <div className="cyber-form-group">
            <label className="cyber-label">Full Name</label>
            <input
              type="text"
              name="name"
              className="cyber-input"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Alex Reed"
              required
              disabled={loading}
            />
          </div>

          <div className="cyber-form-group">
            <label className="cyber-label">Email Address</label>
            <input
              type="email"
              name="email"
              className="cyber-input"
              value={formData.email}
              onChange={handleChange}
              placeholder="neural@identity.io"
              required
              disabled={loading}
            />
          </div>

          <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="cyber-form-group">
              <label className="cyber-label">Access Protocol</label>
              <input
                type="password"
                name="password"
                className="cyber-input"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength="6"
              />
            </div>
            <div className="cyber-form-group">
              <label className="cyber-label">Verify Protocol</label>
              <input
                type="password"
                name="confirmPassword"
                className="cyber-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                disabled={loading}
                minLength="6"
              />
            </div>
          </div>

          <div className="cyber-form-group">
            <label className="cyber-label">Sector Assignment (Role)</label>
            <select
              name="role"
              className="cyber-input"
              value={formData.role}
              onChange={handleChange}
              required
              disabled={loading}
            >
              <option value="user">🎟️ CITIZEN (Buy Tickets)</option>
              <option value="organizer">🎭 ARCHITECT (List Events)</option>
              <option value="staff">🛡️ ENFORCER (Scan Only)</option>
            </select>
          </div>

          <button type="submit" className="cyber-btn btn-glow" style={{ width: '100%', padding: '1.2rem', marginTop: '1.5rem' }} disabled={loading}>
            {loading ? 'INITIALIZING...' : 'CREATE IDENTITY'}
          </button>
        </form>

        <div className="flex-center" style={{ marginTop: '2.5rem' }}>
          <p className="text-muted">
            Already registered?{' '}
            <button 
              className="cyber-btn btn-outline" 
              style={{ border: 'none', background: 'transparent', padding: '0 5px', color: 'var(--accent-indigo)' }}
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              Access System
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
