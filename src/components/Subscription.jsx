import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import './Subscription.css';

const Subscription = () => {
    const { user, login } = useAuth(); // Assuming login updates the user state or we need a way to refresh user
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const plans = [
        { id: '7_days', title: 'Weekly Access', duration: '7 Days', price: '₹199', features: ['Basic Support', 'Limited Analytics'] },
        { id: '30_days', title: 'Monthly Plan', duration: '30 Days', price: '₹499', features: ['Priority Support', 'Full Analytics', '10% Discount'] },
        { id: '3_months', title: 'Quarterly Plan', duration: '3 Months', price: '₹1,299', features: ['Priority Support', 'Full Analytics', '15% Discount'] },
        { id: '6_months', title: 'Biannual Plan', duration: '6 Months', price: '₹2,499', features: ['Priority Support', 'Full Analytics', '20% Discount'] },
        { id: '1_year', title: 'Annual Plan', duration: '1 Year', price: '₹3,999', features: ['VIP Support', 'All Features', '25% Discount'] }
    ];

    const currentPlan = user?.subscription?.plan || 'none';

    const handleSubscribe = async (planId) => {
        setLoading(true);
        setMessage('');
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_URL}/subscription/upgrade`,
                { plan: planId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setMessage(`Successfully subscribed to ${response.data.subscription.plan}`);
                // Ideally, we should update the auth context user object here.
                // Since I might not have direct access to set user, a page reload or similar might be needed
                // Or if 'login' or a 'refreshUser' function is available in context.
                // For now, alert and reload is safe if context doesn't expose updater.
                alert('Subscription updated! Processing...');
                window.location.reload(); 
            }
        } catch (error) {
            console.error('Subscription error:', error);
            setMessage(error.response?.data?.error || 'Failed to upgrade subscription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="subscription-container">
            <h2>Select Your Membership Plan</h2>
            {message && <div className="subscription-message">{message}</div>}
            
            <div className="current-status">
                Current Plan: <span className="status-badge">{currentPlan.replace('_', ' ')}</span>
                {user?.subscription?.endDate && (
                     <span> (Expires: {new Date(user.subscription.endDate).toLocaleDateString()})</span>
                )}
            </div>

            <div className="plans-grid">
                {plans.map((plan) => (
                    <div key={plan.id} className={`plan-card ${currentPlan === plan.id ? 'active-plan' : ''}`}>
                        <div className="plan-header">
                            <h3>{plan.title}</h3>
                            <div className="plan-price">{plan.price}</div>
                            <div className="plan-duration">{plan.duration}</div>
                        </div>
                        <ul className="plan-features">
                            {plan.features.map((feature, idx) => (
                                <li key={idx}>{feature}</li>
                            ))}
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
