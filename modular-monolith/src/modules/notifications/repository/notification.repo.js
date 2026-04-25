import Notification from '../model/notification.model.js';

export const create = async (data) => {
  return await Notification.create(data);
};

export const findByUser = async (userId) => {
  return await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
};

export const markAsRead = async (id, userId) => {
  return await Notification.findOneAndUpdate({ _id: id, userId }, { read: true }, { new: true });
};

export const markAllAsRead = async (userId) => {
  return await Notification.updateMany({ userId, read: false }, { read: true });
};

export default {
  create,
  findByUser,
  markAsRead,
  markAllAsRead
};
