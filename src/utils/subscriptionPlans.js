// Dynamic Ticket Pricing System v2.0
// Subscription Plans Configuration
// Edit this file to modify available plans

export const subscriptionPlans = [
  {
    id: '7_days',
    title: 'Weekly Access',
    duration: '7 Days',
    price: '₹199',
    priceValue: 199,
    features: ['Basic Support', 'Limited Analytics']
  },
  {
    id: '30_days',
    title: 'Monthly Plan',
    duration: '30 Days',
    price: '₹499',
    priceValue: 499,
    features: ['Priority Support', 'Full Analytics', '10% Discount']
  },
  {
    id: '3_months',
    title: 'Quarterly Plan',
    duration: '3 Months',
    price: '₹1,299',
    priceValue: 1299,
    features: ['Priority Support', 'Full Analytics', '15% Discount']
  },
  {
    id: '6_months',
    title: 'Biannual Plan',
    duration: '6 Months',
    price: '₹2,499',
    priceValue: 2499,
    features: ['Priority Support', 'Full Analytics', '20% Discount']
  },
  {
    id: '1_year',
    title: 'Annual Plan',
    duration: '1 Year',
    price: '₹3,999',
    priceValue: 3999,
    features: ['VIP Support', 'All Features', '25% Discount']
  }
];

// Helper to get plan by ID
export const getPlanById = (planId) => {
  return subscriptionPlans.find(plan => plan.id === planId);
};

// Helper to get plan duration in days
export const getPlanDurationDays = (planId) => {
  const durationMap = {
    '7_days': 7,
    '30_days': 30,
    '3_months': 90,
    '6_months': 180,
    '1_year': 365
  };
  return durationMap[planId] || 0;
};
