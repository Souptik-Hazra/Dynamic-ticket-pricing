import Event from '../model/event.model.js';

export const listPublicEvents = async ({ page = 1, limit = 20, cursor = null } = {}) => {
  const filter = { status: { $ne: 'cancelled' } };
  if (cursor) {
    filter._id = { $gt: cursor };
  }

  const skip = Math.max(0, (page - 1)) * Number(limit || 20);
  return await Event.find(filter)
    .select('-seatMap -bookedSeats -blockedSeats') // Project out heavy fields
    .sort({ startDate: 1 })
    .skip(skip)
    .limit(Number(limit || 20))
    .lean(); // Faster, plain JS objects
};

export const findById = async (id) => {
  const query = Event.findById(id).lean(); // Lean by default for single lookups
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_QUERY_TIMEOUT')), 2000));
  return await Promise.race([query, timeout]).catch(err => {
    if (err.message === 'DB_QUERY_TIMEOUT') console.warn(`🚩 [SRE] Query timeout on Event:${id}`);
    throw err;
  });
};

export const findByCategory = async (category, { page = 1, limit = 20 } = {}) => {
  const skip = Math.max(0, (page - 1)) * Number(limit || 20);
  return await Event.find({ 
    category: category.toLowerCase(), 
    status: 'upcoming' 
  })
  .select('-seatMap -bookedSeats -blockedSeats')
  .sort({ startDate: 1 })
  .skip(skip)
  .limit(Number(limit || 20))
  .lean();
};

export const countEvents = async (filter) => {
  return await Event.countDocuments(filter);
};

export const findMany = async (filter, select = {}) => {
  return await Event.find(filter).select(select).sort({ startDate: 1 });
};

export const create = async (data) => {
  return await Event.create(data);
};

export const findOneAndUpdate = async (filter, update) => {
  return await Event.findOneAndUpdate(filter, update, { new: true, runValidators: true });
};

export const findOneAndDelete = async (filter) => {
  return await Event.findOneAndDelete(filter);
};

export const findByIdAndOrganizer = async (id, organizerId) => {
  return await Event.findOne({ _id: id, organizerId });
};

export const completePastEvents = async (now) => {
  const result = await Event.updateMany(
    { status: { $in: ['upcoming', 'ongoing'] }, endDate: { $lt: now } },
    { $set: { status: 'completed' } }
  );
  return result.modifiedCount;
};

export default {
  listPublicEvents,
  findById,
  findByCategory,
  countEvents,
  findMany,
  create,
  findOneAndUpdate,
  updateInventory: findOneAndUpdate,
  findOneAndDelete,
  findByIdAndOrganizer,
  completePastEvents
};
