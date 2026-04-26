import mongoose from 'mongoose';
import bus from '../../../shared/utils/bus.js';
import { cacheDel, cacheDelPattern } from '../../../shared/utils/cache.js';
import adminRepo from '../repository/admin.repo.js';

// Cross-module service calls
import userService from '../../users/service/user.service.js';
import catalogService from '../../catalog/service/catalog.service.js';
import ticketService from '../../tickets/service/ticket.service.js';
import paymentRepo from '../../payments/repository/payment.repo.js';

export const getSystemStats = async () => {
  const [totalEvents, totalUsers, ticketAgg, recentTickets] = await Promise.all([
    catalogService.countEvents({}),
    userService.countDocuments({ role: { $ne: 'admin' } }),
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
export const getAllAdmins = () => userService.listUsers({ role: 'admin' });
export const getAllUsers = () => userService.listUsers({ role: { $ne: 'admin' } });
export const getAllCommissions = () => adminRepo.listCommissions();
export const getAllWallets = () => paymentRepo.listAllWallets();

export const createEvent = async (data) => {
  const event = await catalogService.create(data);
  await cacheDelPattern('events:list:*');
  return event;
};

export const updateUserRole = async (userId, role) => {
  return await userService.updateProfile(userId, { role }, { role: 'admin' }); // Mock admin for override
};

export const manageEventStatus = async (eventId, status, adminId) => {
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
    });

    event.status = 'completed';
    await event.save();

    bus.publish('event.completed', {
      eventId: event._id,
      organizerId: event.organizerId,
      commissionAmount: commission
    });
  } else {
    event.status = status;
    await event.save();
  }

  await cacheDel(`event:${eventId}`);
  await cacheDelPattern('events:list:*');
  return event;
};

export const purgeEvent = async (eventId) => {
  const event = await catalogService.findOneAndDelete({ _id: eventId });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  await ticketService.updateStatus({ eventId }, 'cancelled');
  await cacheDel(`event:${eventId}`);
  await cacheDelPattern('events:list:*');
  return true;
};

export const broadcastMessage = async (target, targetId, title, message) => {
  let userIds = [];
  if (target === 'all_organizers') {
    const users = await userService.listUsers({ role: 'organizer' });
    userIds = users.map(u => u._id);
  } else if (target === 'all_users') {
    const users = await userService.listUsers({ role: 'user' });
    userIds = users.map(u => u._id);
  } else if (target === 'individual' && targetId) {
    userIds = [targetId];
  }

  for (const uid of userIds) {
    bus.publish('system.alert', { userId: uid, title: `📢 ADMIN: ${title}`, message });
  }
  return userIds.length;
};

export const adjustWallet = async (walletId, amount, type, description) => {
  const wallet = await paymentRepo.findWalletById(walletId);
  if (!wallet) throw new Error('WALLET_NOT_FOUND');

  const numAmount = Math.abs(Number(amount));
  return await paymentRepo.updateWalletBalance(wallet.userId, (type === 'debit' ? -numAmount : numAmount), type, description, { new: true });
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
