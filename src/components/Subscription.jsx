import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { buildUrl } from '../config/api';
import { subscriptionPlans } from '../utils/subscriptionPlans';
import './Subscription.css';

const Subscription = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const currentPlan = user?.subscription?.plan || 'none';

  const handleSubscribe = async (planId) => {
    setLoading(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        buildUrl('/subscription/upgrade'),
        { plan: planId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setMessage(`✅ Successfully subscribed to ${data.subscription.plan.replace(/_/g, ' ')}`);
        // Refresh user object in context so the nav badge updates immediately
        await updateUser({});
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setMessage(err.response?.data?.error || 'Failed to upgrade subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscription-container">
      <h2>Select Your Membership Plan</h2>
      {message && <div className="subscription-message">{message}</div>}

      <div className="current-status">
        Current Plan: <span className="status-badge">{currentPlan.replace(/_/g, ' ')}</span>
        {user?.subscription?.endDate && (
          <span> (Expires: {new Date(user.subscription.endDate).toLocaleDateString()})</span>
        )}
      </div>

      <div className="plans-grid">
        {subscriptionPlans.map((plan) => (
          <div key={plan.id} className={`plan-card ${currentPlan === plan.id ? 'active-plan' : ''}`}>
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
              disabled={loading || currentPlan === plan.id}
              onClick={() => handleSubscribe(plan.id)}
            >
              {loading ? 'Processing...' : currentPlan === plan.id ? 'Current Plan' : 'Subscribe Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Subscription;
