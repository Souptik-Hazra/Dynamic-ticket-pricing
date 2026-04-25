import User from '../model/user.model.js';

export const findById = async (id) => {
  return await User.findById(id);
};

export const findByEmail = async (email) => {
  return await User.findOne({ email });
};

export const findOne = async (filter) => {
  return await User.findOne(filter);
};

export const listUsers = async (filter = {}) => {
  return await User.find(filter).sort({ createdAt: -1 });
};

export const countDocuments = async (filter = {}) => {
  return await User.countDocuments(filter);
};

export const update = async (id, data, options = { new: true, runValidators: true }) => {
  return await User.findByIdAndUpdate(id, data, options);
};

export const remove = async (id) => {
  return await User.findByIdAndDelete(id);
};

export default {
  findById,
  findByEmail,
  findOne,
  listUsers,
  countDocuments,
  update,
  remove
};
