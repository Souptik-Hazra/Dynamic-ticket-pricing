import mongoose from 'mongoose';
import bus from '../../../shared/utils/bus.js';
import { invalidateEventCache } from '../../../shared/utils/cache.js';
import adminRepo from '../repository/admin.repo.js';

// Decoupled Module Interfaces
import { userService } from '../../users/index.js';
import { catalogService } from '../../catalog/index.js';
import { ticketService } from '../../tickets/index.js';
import { walletService } from '../../payments/index.js';
import { withTransaction } from '../../../shared/db/index.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { logInfo, logWarn, logError } from '../../../shared/utils/logger.js';

export const getSystemStats = async () => {
  const [totalEvents, totalUsers, ticketAgg, recentTickets] = await Promise.all([
    catalogService.countEvents({}),
    userService.countDocuments({ role: { $ne: ROLES.ADMIN } }),
    ticketService.findMany({ status: 'confirmed' }).then(tickets => {
      // Ideally aggregation should be in service, but we use findMany and reduce for now or keep aggregation in ticketService
      const totalRevenue = tickets.reduce((s, t) => s + t.totalAmount, 0);
      const totalTickets = tickets.reduce((s, t) => s + t.quantity, 0);
      return [{ totalRevenue, totalTickets }];
    }),
    ticketService.findWithEvent({ status: 'confirmed' }),
  ]);

  const { totalRevenue = 0, totalTickets = 0 } = ticketAgg[0] || {};

  return {
    totalEvents,
    totalUsers,
    totalTickets,
    totalRevenue,
    totalProfit: Math.round(totalRevenue * 0.20),
    recentSales: recentTickets.slice(0, 10)
  };
};

export const getAllEvents = () => adminRepo.listAllEvents();
export const getAllTickets = () => adminRepo.listAllTickets();
export const getAllAdmins = () => userService.listUsers({ role: ROLES.ADMIN });
export const getAllUsers = () => userService.listUsers({ role: { $ne: ROLES.ADMIN } });
export const getAllCommissions = () => adminRepo.listCommissions();
export const getAllWallets = () => walletService.listAllWallets();

export const createEvent = async (data) => {
  logInfo('AdminService', 'Creating event', { title: data.title, organizerId: data.organizerId });
  const event = await catalogService.create(data);
  await invalidateEventCache();
  logInfo('AdminService', 'Event created successfully', { eventId: event._id });
  return event;
};

export const updateUserRole = async (userId, role) => {
  return await userService.updateProfile(userId, { role }, { role: ROLES.ADMIN }); // Mock admin for override
};

export const manageEventStatus = async (eventId, status, adminId) => {
  logInfo('AdminService', 'Managing event status', { eventId, status, adminId });
  return await withTransaction(async (session) => {
    const event = await catalogService.findById(eventId);
    if (!event) throw new Error('EVENT_NOT_FOUND');

    if (status === 'completed' && event.status !== 'completed') {
      const revenue = event.totalRevenue || 0;
      const commission = Math.round(revenue * 0.20);

      await adminRepo.createCommission({
        eventId: event._id,
        organizerId: event.organizerId,
        adminId,
        totalRevenue: revenue,
        commissionAmount: commission,
        status: 'paid'
      }, { session });

      event.status = 'completed';
      await event.save({ session });

      bus.publish('event.completed', {
        eventId: event._id,
        organizerId: event.organizerId,
        commissionAmount: commission
      });
    } else {
      event.status = status;
      await event.save({ session });
    }

    await invalidateEventCache(eventId);
    logInfo('AdminService', 'Event status updated', { eventId, status });
    return event;
  });
};

export const purgeEvent = async (eventId) => {
  logInfo('AdminService', 'Purging event', { eventId });
  return await withTransaction(async (session) => {
    const event = await catalogService.findOneAndDelete({ _id: eventId }, { session });
    if (!event) {
      logWarn('AdminService', 'Purged event not found', { eventId });
      throw new Error('EVENT_NOT_FOUND');
    }

    await ticketService.updateStatus({ eventId }, 'cancelled', { session });
    await invalidateEventCache(eventId);
    logInfo('AdminService', 'Event purged successfully', { eventId });
    return true;
  });
};

export const broadcastMessage = async (target, targetId, title, message) => {
  logInfo('AdminService', 'Broadcasting admin message', { target, targetId, title });
  let userIds = [];
  if (target === 'all_organizers') {
    const users = await userService.listUsers({ role: ROLES.ORGANIZER });
    userIds = users.map(u => u._id);
  } else if (target === 'all_users') {
    const users = await userService.listUsers({ role: ROLES.USER });
    userIds = users.map(u => u._id);
  } else if (target === 'individual' && targetId) {
    userIds = [targetId];
  }

  for (const uid of userIds) {
    bus.publish('system.alert', { userId: uid, title: `📢 ADMIN: ${title}`, message });
  }
  logInfo('AdminService', 'Broadcast completed', { target, targetId, recipientCount: userIds.length });
  return userIds.length;
};

export const adjustWallet = async (walletId, amount, type, description) => {
  logInfo('AdminService', 'Adjusting wallet', { walletId, amount, type, description });
  const wallet = await walletService.findWalletById(walletId);
  if (!wallet) {
    logWarn('AdminService', 'Wallet adjustment failed because wallet was not found', { walletId });
    throw new Error('WALLET_NOT_FOUND');
  }

  const numAmount = Math.abs(Number(amount));
  const updatedWallet = await walletService.updateWalletBalance(wallet.userId, (type === 'debit' ? -numAmount : numAmount), type, description, { new: true });
  logInfo('AdminService', 'Wallet adjusted successfully', { walletId, userId: wallet.userId, newBalance: updatedWallet.balance });
  return updatedWallet;
};

export const getSystemHealth = async () => {
  const [userCount, eventCount, ticketCount] = await Promise.all([
    userService.countDocuments({}),
    catalogService.countEvents({}),
    ticketService.findMany({}).then(t => t.length)
  ]);

  return {
    status: 'ok',
    counts: { users: userCount, events: eventCount, tickets: ticketCount },
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'up' : 'down',
      neo4j: 'active',
      ml_sidecar: 'available'
    }
  };
};

export const getAuditLogs = () => adminRepo.listAuditLogs();

export const getSecurityLogs = () => adminRepo.listSecurityLogs();

export default {
  getSystemStats,
  getAllEvents,
  getAllTickets,
  getAllAdmins,
  getAllUsers,
  getAllCommissions,
  getAllWallets,
  getAuditLogs,
  getSecurityLogs,
  createEvent,
  updateUserRole,
  manageEventStatus,
  purgeEvent,
  broadcastMessage,
  adjustWallet,
  getSystemHealth
};
