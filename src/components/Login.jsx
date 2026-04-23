import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';

function Login({ onSwitchToSignup }) {
  const { signin } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);

    const result = await signin(data.email, data.password);

    if (!result.success) {
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

        <form onSubmit={handleSubmit(onSubmit)} className="flex-column" style={{ gap: '1.5rem' }}>
          <div className="cyber-form-group">
            <label className="cyber-label" htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
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

          <div className="cyber-form-group">
            <label className="cyber-label" htmlFor="password">Access Protocol (Password)</label>
            <input
              type="password"
              id="password"
              className={`cyber-input ${errors.password ? 'error' : ''}`}
              {...register('password', { 
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
              placeholder="••••••••"
              disabled={loading}
            />
            {errors.password && <span className="text-danger" style={{ fontSize: '0.75rem' }}>{errors.password.message}</span>}
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
