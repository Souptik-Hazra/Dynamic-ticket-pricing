import Subscription from '../model/subscription.model.js';

export const findByUserId = async (userId) => {
  return await Subscription.findOne({ userId });
};

export const updateSubscription = async (userId, data) => {
  return await Subscription.findOneAndUpdate({ userId }, data, { upsert: true, new: true });
};

export default {
  findByUserId,
  updateSubscription
};
