import { SUBSCRIPTION_PLANS, getPlanDuration } from '../model/subscription.model.js';
import subscriptionRepo from '../repository/subscription.repo.js';
import bus from '../../../shared/utils/bus.js';

// Cross-module repository calls
import userRepo from '../../users/repository/user.repo.js';

export const getPlans = () => SUBSCRIPTION_PLANS;

export const getUserSubscription = async (userId) => {
  const sub = await subscriptionRepo.findByUserId(userId);
  if (!sub) return { plan: 'none', isActive: false };
  
  if (sub.isActive && sub.endDate < new Date()) {
    sub.isActive = false;
    await sub.save();
    
    // Decoupled notification via Bus
    bus.publish('subscription.expired', { 
      userId, 
      plan: sub.plan 
    });
  }
  return sub;
};

export const upgradeSubscription = async (userId, userEmail, userName, plan) => {
  const durationDays = getPlanDuration(plan);
  if (!durationDays) throw new Error('INVALID_PLAN');

  const now = new Date();
  const endDate = new Date(now.getTime() + durationDays * 86400000);

  const subscription = await subscriptionRepo.updateSubscription(userId, { 
    plan, startDate: now, endDate, isActive: true 
  });

  // Sync with user model (internal data sync)
  await userRepo.update(userId, { 
    subscription: { plan, isActive: true, endDate } 
  });

  const planLabel = plan.replace(/_/g, ' ');
  const expiryStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Decoupled side-effects via Bus
  bus.publish('subscription.upgraded', {
    userId,
    userEmail,
    userName,
    plan,
    planLabel,
    expiryStr
  });

  return subscription;
};

export default { 
  getPlans, 
  getUserSubscription, 
  upgradeSubscription 
};
