import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';

function Signup({ onSwitchToLogin }) {
  const { signup } = useAuth();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      role: 'user'
    }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const password = watch("password", "");

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);

    const result = await signup(data.name, data.email, data.password, data.role);

    if (!result.success) {
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

        <form onSubmit={handleSubmit(onSubmit)} className="flex-column" style={{ gap: '1.2rem' }}>
          <div className="cyber-form-group">
            <label className="cyber-label">Full Name</label>
            <input
              type="text"
              className={`cyber-input ${errors.name ? 'error' : ''}`}
              {...register('name', { required: 'Full name is required' })}
              placeholder="e.g., Alex Reed"
              disabled={loading}
            />
            {errors.name && <span className="text-danger" style={{ fontSize: '0.75rem' }}>{errors.name.message}</span>}
          </div>

          <div className="cyber-form-group">
            <label className="cyber-label">Email Address</label>
            <input
              type="email"
              className={`cyber-input ${errors.email ? 'error' : ''}`}
              {...register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address"
                }
              })}
              placeholder="neural@identity.io"
              disabled={loading}
            />
            {errors.email && <span className="text-danger" style={{ fontSize: '0.75rem' }}>{errors.email.message}</span>}
          </div>

          <div className="cyber-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="cyber-form-group">
              <label className="cyber-label">Access Protocol</label>
              <input
                type="password"
                className={`cyber-input ${errors.password ? 'error' : ''}`}
                {...register('password', { 
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Min 6 characters' }
                })}
                placeholder="••••••••"
                disabled={loading}
              />
              {errors.password && <span className="text-danger" style={{ fontSize: '0.75rem' }}>{errors.password.message}</span>}
            </div>
            <div className="cyber-form-group">
              <label className="cyber-label">Verify Protocol</label>
              <input
                type="password"
                className={`cyber-input ${errors.confirmPassword ? 'error' : ''}`}
                {...register('confirmPassword', { 
                  required: 'Please confirm your password',
                  validate: value => value === password || 'Passwords do not match'
                })}
                placeholder="••••••••"
                disabled={loading}
              />
              {errors.confirmPassword && <span className="text-danger" style={{ fontSize: '0.75rem' }}>{errors.confirmPassword.message}</span>}
            </div>
          </div>

          <div className="cyber-form-group">
            <label className="cyber-label">Sector Assignment (Role)</label>
            <select
              className="cyber-input"
              {...register('role', { required: true })}
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
