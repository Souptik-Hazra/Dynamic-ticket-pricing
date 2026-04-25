import * as adminService from '../service/admin.service.js';

export const getStats = async (req, res, next) => {
  try {
    const stats = await adminService.getSystemStats();
    res.json(stats);
  } catch (err) { next(err); }
};

export const getEvents = async (req, res, next) => {
  try {
    const events = await adminService.getAllEvents();
    res.json({ events });
  } catch (err) { next(err); }
};

export const createEvent = async (req, res, next) => {
  try {
    const event = await adminService.createEvent(req.body);
    res.status(201).json({ event });
  } catch (err) { next(err); }
};

export const updateEventStatus = async (req, res, next) => {
  try {
    const event = await adminService.manageEventStatus(req.params.id, req.body.status, req.user.id);
    res.json({ event });
  } catch (err) {
    if (err.message === 'EVENT_NOT_FOUND') return res.status(404).json({ error: 'Event not found' });
    next(err);
  }
};

export const deleteEvent = async (req, res, next) => {
  try {
    await adminService.purgeEvent(req.params.id);
    res.json({ success: true, message: 'Event and associated tickets purged' });
  } catch (err) { next(err); }
};

export const getTickets = async (req, res, next) => {
  try {
    const tickets = await adminService.getAllTickets();
    res.json({ tickets });
  } catch (err) { next(err); }
};

export const getAdmins = async (req, res, next) => {
  try {
    const admins = await adminService.getAllAdmins();
    res.json({ admins });
  } catch (err) { next(err); }
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await adminService.getAllUsers();
    res.json({ users });
  } catch (err) { next(err); }
};

export const updateRole = async (req, res, next) => {
  try {
    const user = await adminService.updateUserRole(req.params.id, req.body.role);
    res.json({ message: 'User role updated', user });
  } catch (err) { next(err); }
};

export const broadcast = async (req, res, next) => {
  try {
    const { target, targetId, title, message } = req.body;
    const count = await adminService.broadcastMessage(target, targetId, title, message);
    res.json({ success: true, count });
  } catch (err) { next(err); }
};

export const getCommissions = async (req, res, next) => {
  try {
    const commissions = await adminService.getAllCommissions();
    res.json({ commissions });
  } catch (err) { next(err); }
};

export const getWallets = async (req, res, next) => {
  try {
    const wallets = await adminService.getAllWallets();
    res.json({ wallets });
  } catch (err) { next(err); }
};

export const adjustWallet = async (req, res, next) => {
  try {
    const { amount, type, description } = req.body;
    const wallet = await adminService.adjustWallet(req.params.id, amount, type, description);
    res.json({ message: 'Wallet adjusted', wallet });
  } catch (err) {
    if (err.message === 'WALLET_NOT_FOUND') return res.status(404).json({ error: 'Wallet not found' });
    next(err);
  }
};

export const health = async (req, res) => {
  try {
    const health = await adminService.getSystemHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
};

export default {
  getStats,
  getEvents,
  createEvent,
  updateEventStatus,
  deleteEvent,
  getTickets,
  getAdmins,
  getUsers,
  updateRole,
  broadcast,
  getCommissions,
  getWallets,
  adjustWallet,
  health
};
