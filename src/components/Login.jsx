import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Login({ onSwitchToSignup }) {
  const { signin } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
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
    setLoading(true);

    const result = await signin(formData.email, formData.password);

    if (result.success) {
      // Navigation will be handled by App.jsx based on auth state
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="flex-center" style={{ minHeight: '80vh' }}>
      <div className="cyber-card animate-fade-up" style={{ maxWidth: '450px', width: '100%', padding: '3rem' }}>
        <div className="flex-column flex-center" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <h2 className="title-main text-gradient" style={{ margin: 0, fontSize: '2.5rem' }}>🎫 Welcome</h2>
          <p className="text-muted">Access the platform with your neural credentials</p>
        </div>

        {error && (
          <div className="cyber-badge badge-danger" style={{ width: '100%', padding: '1rem', marginBottom: '2rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-column" style={{ gap: '1.5rem' }}>
          <div className="cyber-form-group">
            <label className="cyber-label" htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              className="cyber-input"
              value={formData.email}
              onChange={handleChange}
              placeholder="neural@identity.io"
              required
              disabled={loading}
            />
          </div>

          <div className="cyber-form-group">
            <label className="cyber-label" htmlFor="password">Access Protocol (Password)</label>
            <input
              type="password"
              id="password"
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

          <button type="submit" className="cyber-btn btn-glow" style={{ width: '100%', padding: '1.2rem', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'SYNCHRONIZING...' : 'SIGN IN'}
          </button>
        </form>

        <div className="flex-center" style={{ marginTop: '2.5rem' }}>
          <p className="text-muted">
            New to the platform?{' '}
            <button
              className="cyber-btn btn-outline"
              style={{ border: 'none', background: 'transparent', padding: '0 5px', color: 'var(--accent-indigo)' }}
              onClick={onSwitchToSignup}
              disabled={loading}
            >
              Initialize Identity
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
