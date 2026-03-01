// Subscription plan configurations and mappings
export const SUBSCRIPTION_PLANS = {
  '7_days': {
    id: '7_days',
    label: 'WEEKLY',
    title: 'Weekly Access',
    duration: '7 Days',
    price: '₹199',
    features: ['Basic Support', 'Limited Analytics']
  },
  '30_days': {
    id: '30_days',
    label: 'MONTHLY',
    title: 'Monthly Plan',
    duration: '30 Days',
    price: '₹499',
    features: ['Priority Support', 'Full Analytics', '10% Discount']
  },
  '3_months': {
    id: '3_months',
    label: 'QUARTERLY',
    title: 'Quarterly Plan',
    duration: '3 Months',
    price: '₹1,299',
    features: ['Priority Support', 'Full Analytics', '15% Discount']
  },
  '6_months': {
    id: '6_months',
    label: 'BIANNUAL',
    title: 'Biannual Plan',
    duration: '6 Months',
    price: '₹2,499',
    features: ['Priority Support', 'Full Analytics', '20% Discount']
  },
  '1_year': {
    id: '1_year',
    label: 'ANNUAL',
    title: 'Annual Plan',
    duration: '1 Year',
    price: '₹3,999',
    features: ['VIP Support', 'All Features', '25% Discount']
  },
  'none': {
    id: 'none',
    label: 'FREE',
    title: 'No Subscription',
    duration: 'None',
    price: 'Free',
    features: []
  }
};

// Get label for a subscription plan ID
export const getPlanLabel = (planId) => {
  return SUBSCRIPTION_PLANS[planId]?.label || 'MEMBER';
};

// Get all plans as array (for rendering lists)
export const getAllPlans = () => {
  return Object.values(SUBSCRIPTION_PLANS).filter(plan => plan.id !== 'none');
};

// Check if user has active subscription
export const hasActiveSubscription = (user) => {
  return user?.subscription && 
         user.subscription.isActive && 
         user.subscription.plan !== 'none';
};

// Get plan details by ID
export const getPlanDetails = (planId) => {
  return SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS['none'];
};
