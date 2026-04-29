import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../../../shared/config/index.js';
import authRepo from '../repository/auth.repo.js';
import bus from '../../../shared/utils/bus.js';

import { ROLES } from '../../../shared/constants/roles.js';

export const issueToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiry }
  );
};

export const issueRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id.toString() },
    config.jwt.secret,
    { expiresIn: '7d' } 
  );
};

export const registerUser = async (name, email, password, role) => {
  const hashed = await bcrypt.hash(password, 12);
  const user = await authRepo.create({ 
    name, 
    email, 
    password: hashed, 
    role: role === ROLES.ORGANIZER ? ROLES.ORGANIZER : ROLES.USER 
  });
  
  // Publish for Neo4j Sync & Analytics
  bus.publish('user.registered', user);

  const token = issueToken(user);
  const refreshToken = issueRefreshToken(user);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await authRepo.updateRefreshToken(user._id, refreshTokenHash);

  return { token, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } };
};

export const loginUser = async (email, password) => {
  const user = await authRepo.findByEmail(email, true);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const token = issueToken(user);
  const refreshToken = issueRefreshToken(user);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await authRepo.updateRefreshToken(user._id, refreshTokenHash);

  return { token, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } };
};

export const refreshSession = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    const user = await authRepo.findById(decoded.id, true);
    
    if (!user || !user.refreshToken || !(await bcrypt.compare(refreshToken, user.refreshToken))) {
      throw new Error('INVALID_SESSION');
    }

    const newToken = issueToken(user);
    const newRefreshToken = issueRefreshToken(user);
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    await authRepo.updateRefreshToken(user._id, newRefreshTokenHash);

    return { token: newToken, refreshToken: newRefreshToken };
  } catch (err) {
    if (err.message === 'INVALID_SESSION') throw err;
    throw new Error('EXPIRED_SESSION');
  }
};

export const logoutUser = async (userId, token) => {
  await authRepo.clearRefreshToken(userId);
  if (token) {
    const { blacklistToken } = await import('../../../shared/utils/cache.js');
    await blacklistToken(token, 3600); // Blacklist for 1 hour
  }
  return true;
};

export default { 
  issueToken,
  registerUser, 
  loginUser, 
  refreshSession, 
  logoutUser 
};
