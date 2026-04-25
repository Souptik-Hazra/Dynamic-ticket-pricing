import User from '../../users/model/user.model.js';

export const findByEmail = async (email, includePassword = false) => {
  const query = User.findOne({ email });
  if (includePassword) query.select('+password');
  return await query;
};

export const findById = async (id, includePassword = false) => {
  const query = User.findById(id);
  if (includePassword) query.select('+password');
  return await query;
};

export const create = async (data) => {
  return await User.create(data);
};

export const updateRefreshToken = async (userId, refreshToken) => {
  return await User.findByIdAndUpdate(userId, { refreshToken });
};

export const clearRefreshToken = async (userId) => {
  return await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
};

export default {
  findByEmail,
  findById,
  create,
  updateRefreshToken,
  clearRefreshToken
};
