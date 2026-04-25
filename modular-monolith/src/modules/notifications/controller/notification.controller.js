import * as notificationService from '../service/notification.service.js';

export const listAll = async (req, res, next) => {
  try {
    const notifications = await notificationService.getUserNotifications(req.user.id);
    res.json({ notifications });
  } catch (err) { next(err); }
};

export const markRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    res.json({ notification });
  } catch (err) {
    if (err.message === 'NOTIFICATION_NOT_FOUND') return res.status(404).json({ error: 'Notification not found' });
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export default {
  listAll,
  markRead,
  markAllRead
};
