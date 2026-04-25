import Ticket from '../model/ticket.model.js';

export const create = async (data) => {
  return await Ticket.create(data);
};

export const findById = async (id) => {
  return await Ticket.findById(id);
};

export const findByQrToken = async (qrToken) => {
  return await Ticket.findOne({ qrToken });
};

export const findByUser = async (userId) => {
  return await Ticket.find({ userId }).sort({ purchaseDate: -1 });
};

export const findByEvent = async (eventId) => {
  return await Ticket.find({ eventId }).sort({ purchaseDate: -1 });
};

export const update = async (id, data, options = { new: true }) => {
  return await Ticket.findByIdAndUpdate(id, data, options);
};

export const updateStatus = async (id, status) => {
  return await Ticket.findByIdAndUpdate(id, { status }, { new: true });
};

export const updateMany = async (filter, update, options = {}) => {
  return await Ticket.updateMany(filter, update, options);
};

export const aggregate = async (pipeline) => {
  return await Ticket.aggregate(pipeline);
};

export const findWithEvent = async (filter) => {
  return await Ticket.find(filter).populate('eventId', 'name').sort({ purchaseDate: -1 });
};

export const findMany = async (filter, select = {}) => {
  return await Ticket.find(filter).select(select).sort({ purchaseDate: -1 });
};

export const findPendingExpired = async (threshold) => {
  return await Ticket.find({
    status: 'pending_payment',
    createdAt: { $lt: threshold }
  });
};

export const findConfirmedSince = async (date) => {
  return await Ticket.find({
    status: 'confirmed',
    purchaseDate: { $gte: date }
  });
};

export const deleteMany = async (filter) => {
  return await Ticket.deleteMany(filter);
};

export const countDocuments = async (filter = {}) => {
  return await Ticket.countDocuments(filter);
};

export default {
  create,
  findById,
  findByQrToken,
  findByUser,
  findByEvent,
  update,
  updateStatus,
  updateMany,
  aggregate,
  findWithEvent,
  findMany,
  findPendingExpired,
  findConfirmedSince,
  deleteMany,
  countDocuments
};
