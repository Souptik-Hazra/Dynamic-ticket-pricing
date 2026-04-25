import Commission from '../model/commission.model.js';
import User from '../../users/model/user.model.js';
import Event from '../../catalog/model/event.model.js';
import Ticket from '../../tickets/model/ticket.model.js';
import Wallet from '../../payments/model/wallet.model.js';

export const listAllEvents = async () => {
  return await Event.find().sort({ createdAt: -1 });
};

export const listAllTickets = async () => {
  return await Ticket.find().sort({ purchaseDate: -1 }).populate('eventId', 'name');
};

export const listAllUsers = async (filter = {}) => {
  return await User.find(filter).sort({ createdAt: -1 });
};

export const listCommissions = async () => {
  return await Commission.find().sort({ createdAt: -1 }).populate('organizerId', 'name email');
};

export const listAllWallets = async () => {
  return await Wallet.find().populate('userId', 'name email');
};

export const createCommission = async (data) => {
  return await Commission.create(data);
};

export default {
  listAllEvents,
  listAllTickets,
  listAllUsers,
  listCommissions,
  listAllWallets,
  createCommission
};
