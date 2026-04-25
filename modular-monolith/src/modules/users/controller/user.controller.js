import * as userService from '../service/user.service.js';

export const getMe = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    res.json({ user: profile });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'User not found' });
    next(err);
  }
};

export const listAll = async (req, res, next) => {
  try {
    const users = await userService.listUsers();
    res.json({ users });
  } catch (err) { next(err); }
};

export const getOne = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.params.id);
    res.json({ user: profile });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'User not found' });
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const result = await userService.updateProfile(req.params.id, req.body, req.user);
    res.json(result);
  } catch (err) { 
    if (err.message === 'UNAUTHORIZED') return res.status(403).json({ error: 'Not authorized' });
    if (err.message === 'PASSWORD_TOO_SHORT') return res.status(400).json({ error: 'Password too short' });
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'User not found' });
    if (err.code === 11000) return res.status(409).json({ error: 'Email already in use' });
    next(err); 
  }
};

export const remove = async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'USER_NOT_FOUND') return res.status(404).json({ error: 'User not found' });
    next(err);
  }
};

export default {
  getMe,
  listAll,
  getOne,
  update,
  remove
};
