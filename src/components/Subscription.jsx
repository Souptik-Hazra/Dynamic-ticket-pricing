import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../config/api';
const Subscription = () => {
  const { user, refreshUser } = useAuth();
  const [loading,    setLoading]    = useState(false);
  const [fetchingLive, setFetchingLive] = useState(true);
  const [liveSub,    setLiveSub]    = useState(null);   // fresh from API
  const [subscriptionPlans, setSubscriptionPlans] = useState([]); // Dynamic from backend
  const [message,   setMessage]    = useState({ text: '', isError: false });
  const [currentTime, setCurrentTime] = useState(null);

  // fetchData handles both public and protected endpoints

  // Fetch plans and current subscription on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch available plans (Public data)
        const plansRes = await api.get(ENDPOINTS.SUBSCRIPTION_PLANS);
        setSubscriptionPlans(plansRes.data);
 
        // 2. Fetch user's live subscription (Protected)
        const subRes = await api.get(ENDPOINTS.SUBSCRIPTION);
        setLiveSub(subRes.data);
      } catch (err) {
        console.warn('Could not fetch subscription data:', err.message);
        // Fallback to AuthContext snapshot if API fails
        setLiveSub(user?.subscription || { plan: 'none', isActive: false });
      } finally {
        setFetchingLive(false);
      }
    };
    fetchData();
  }, [user]);  

  useEffect(() => {
    const updateTime = () => setCurrentTime(Date.now());
    const initialTimer = setTimeout(updateTime, 0);
    const interval = setInterval(updateTime, 60000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const currentPlan = liveSub?.plan || user?.subscription?.plan || 'none';
  const isActive    = liveSub?.isActive ?? (user?.subscription?.isActive ?? false);
  const endDate     = liveSub?.endDate || user?.subscription?.endDate;

  const handleSubscribe = async (planId) => {
    setLoading(true);
    setMessage({ text: '', isError: false });
    try {
      const { data } = await api.post(
        ENDPOINTS.SUBSCRIPTION_UPGRADE,
        { plan: planId }
      );
      if (data.success) {
        setLiveSub(data.subscription);                    // update local state immediately
        setMessage({ text: `✅ Subscribed to ${data.subscription.plan.replace(/_/g, ' ')}`, isError: false });
        await refreshUser();                             // sync AuthContext so nav badge updates
      }
    } catch (err) {
      setMessage({
        text: err.response?.data?.error || 'Failed to upgrade subscription',
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const daysLeft = endDate && currentTime
    ? Math.max(0, Math.ceil((new Date(endDate) - currentTime) / 86400000))
    : null;

  return (
    <div className="cyber-container animate-fade-up" style={{ padding: '2rem 0' }}>
      <div className="flex-column" style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="title-main text-gradient">Membership Protocols</h1>
        <p className="text-muted">Elevate your access level to the platform ecosystem.</p>
      </div>

      {/* Live status banner */}
      {fetchingLive ? (
        <div className="flex-center" style={{ padding: '2rem' }}>
          <div className="text-glow animate-pulse">Synchronizing neural link...</div>
        </div>
      ) : (
        <div className="cyber-card" style={{ marginBottom: '2rem', borderLeft: isActive && currentPlan !== 'none' ? '4px solid var(--success)' : '1px solid var(--border-dim)' }}>
          <div className="flex-between">
            <div className="flex-center" style={{ gap: '1rem' }}>
              <span className="cyber-label">Current Sector Access:</span>
              <span className={`cyber-badge ${isActive && currentPlan !== 'none' ? 'badge-success' : 'badge-info'}`}>
                {currentPlan === 'none' ? 'Standard Access' : currentPlan.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            {isActive && endDate && daysLeft !== null && (
              <span className="text-dim" style={{ fontSize: '0.85rem' }}>
                {daysLeft > 0
                  ? `Protocol active for ${daysLeft} more cycles`
                  : 'Protocol offline'}
              </span>
            )}
          </div>
        </div>
      )}

      {message.text && (
        <div className={`cyber-badge ${message.isError ? 'badge-danger' : 'badge-success'}`} style={{ width: '100%', padding: '1rem', marginBottom: '2rem' }}>
          {message.text}
        </div>
      )}

      <div className="cyber-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {subscriptionPlans.map((plan) => (
          <div key={plan.id} className="cyber-card flex-column" style={{ gap: '1.5rem', borderTop: currentPlan === plan.id && isActive ? '4px solid var(--success)' : '1px solid var(--border-dim)' }}>
            <div className="flex-column" style={{ textAlign: 'center', gap: '0.5rem' }}>
              <h3 className="text-main" style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>{plan.title}</h3>
              <div className="text-gradient" style={{ fontSize: '2rem', fontWeight: '950' }}>{plan.price}</div>
              <div className="cyber-label" style={{ fontSize: '0.7rem' }}>{plan.duration}</div>
            </div>
            <div className="flex-column" style={{ gap: '0.8rem', flexGrow: 1 }}>
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.8rem' }}>
                  <span style={{ color: 'var(--success)' }}>✓</span>
                  <span className="text-dim" style={{ fontSize: '0.9rem' }}>{feature}</span>
                </div>
              ))}
            </div>
            <button
              className={`cyber-btn ${currentPlan === plan.id && isActive ? 'btn-outline' : 'btn-primary'}`}
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={loading || (currentPlan === plan.id && isActive)}
              onClick={() => handleSubscribe(plan.id)}
            >
              {loading
                ? 'PROCESSING...'
                : (currentPlan === plan.id && isActive)
                  ? '✓ ACTIVE PROTOCOL'
                  : 'INITIALIZE UPGRADE'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Subscription;
