import * as subscriptionService from '../service/subscription.service.js';

export const listPlans = (req, res) => {
  res.json(subscriptionService.getPlans());
};

export const getMySubscription = async (req, res, next) => {
  try {
    const sub = await subscriptionService.getUserSubscription(req.user.id);
    res.json(sub);
  } catch (err) { next(err); }
};

export const upgrade = async (req, res, next) => {
  try {
    const { plan } = req.body;
    const sub = await subscriptionService.upgradeSubscription(req.user.id, req.user.email, req.user.name, plan);
    res.json({ success: true, subscription: sub });
  } catch (err) {
    if (err.message === 'INVALID_PLAN') return res.status(400).json({ error: 'Invalid plan' });
    next(err);
  }
};

export default {
  listPlans,
  getMySubscription,
  upgrade
};
