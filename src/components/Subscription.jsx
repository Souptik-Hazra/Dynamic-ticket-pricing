import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ENDPOINTS } from '../config/api';
import './Subscription.css';
const Subscription = () => {
  const { user, refreshUser } = useAuth();
  const [loading,    setLoading]    = useState(false);
  const [fetchingLive, setFetchingLive] = useState(true);
  const [liveSub,    setLiveSub]    = useState(null);   // fresh from API
  const [subscriptionPlans, setSubscriptionPlans] = useState([]); // Dynamic from backend
  const [message,   setMessage]    = useState({ text: '', isError: false });

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
  }, [user]); // eslint-disable-line

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

  const daysLeft = endDate
    ? Math.max(0, Math.ceil((new Date(endDate) - Date.now()) / 86400000))
    : null;

  return (
    <div className="subscription-container">
      <h2>Select Your Membership Plan</h2>

      {/* Live status banner */}
      {fetchingLive ? (
        <div className="subscription-loading">Loading your plan...</div>
      ) : (
        <div className={`current-status ${isActive && currentPlan !== 'none' ? 'active-status' : ''}`}>
          <span>Current Plan:</span>
          <span className="status-badge">
            {currentPlan === 'none' ? 'Free' : currentPlan.replace(/_/g, ' ').toUpperCase()}
          </span>
          {isActive && endDate && daysLeft !== null && (
            <span className="expiry-note">
              {daysLeft > 0
                ? `— Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${new Date(endDate).toLocaleDateString()})`
                : '— Expired'}
            </span>
          )}
        </div>
      )}

      {message.text && (
        <div className={`subscription-message ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      <div className="plans-grid">
        {subscriptionPlans.map((plan) => (
          <div key={plan.id} className={`plan-card ${currentPlan === plan.id && isActive ? 'active-plan' : ''}`}>
            <div className="plan-header">
              <h3>{plan.title}</h3>
              <div className="plan-price">{plan.price}</div>
              <div className="plan-duration">{plan.duration}</div>
            </div>
            <ul className="plan-features">
              {plan.features.map((feature, idx) => <li key={idx}>{feature}</li>)}
            </ul>
            <button
              className="subscribe-btn"
              disabled={loading || (currentPlan === plan.id && isActive)}
              onClick={() => handleSubscribe(plan.id)}
            >
              {loading
                ? 'Processing...'
                : (currentPlan === plan.id && isActive)
                  ? '✓ Current Plan'
                  : 'Subscribe Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Subscription;
