import bcrypt from 'bcryptjs';
import userRepo from '../repository/user.repo.js';
import authService from '../../auth/service/auth.service.js';

const safeUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  city: u.city || '',
  birthdate: u.birthdate || null,
  subscription: u.subscription || { plan: 'none', isActive: false },
  botScore: u.botScore || 0,
  createdAt: u.createdAt,
});

export const getProfile = async (userId) => {
  const user = await userRepo.findById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  return safeUser(user);
};

export const listUsers = async (filter = {}) => {
  const users = await userRepo.listUsers(filter);
  return users.map(safeUser);
};

export const updateProfile = async (userId, data, currentUser) => {
  if (currentUser && currentUser.id !== userId && currentUser.role !== 'admin') {
    throw new Error('UNAUTHORIZED');
  }

  const { name, email, city, birthdate, password, role } = data;
  const fields = {};
  if (name) fields.name = name;
  if (email) fields.email = email;
  if (city !== undefined) fields.city = city;
  if (birthdate) fields.birthdate = new Date(birthdate);
  if (role) fields.role = role;
  if (password) {
    if (password.length < 6) throw new Error('PASSWORD_TOO_SHORT');
    fields.password = await bcrypt.hash(password, 12);
  }

  const user = await userRepo.update(userId, fields);
  if (!user) throw new Error('USER_NOT_FOUND');

  const response = { user: safeUser(user) };
  
  if (currentUser && email && email.toLowerCase() !== currentUser.email?.toLowerCase()) {
    response.token = authService.issueToken(user);
  }

  return response;
};

export const deleteUser = async (userId) => {
  const user = await userRepo.remove(userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  return true;
};

// Advanced Service Methods for cross-module use
export const countDocuments = (filter = {}) => userRepo.countDocuments(filter);
export const findOne = (filter) => userRepo.findOne(filter);
export const update = (id, data) => userRepo.update(id, data);

export default { 
  getProfile, 
  listUsers, 
  updateProfile, 
  deleteUser,
  countDocuments,
  findOne,
  update
};
