import * as authService from '../service/auth.service.js';
import response from '../../../shared/utils/response.js';

export const signup = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return response.error(res, 'Missing credentials', 400);
    }

    const result = await authService.registerUser(name, email, password, role);
    response.success(res, result, 'User registered successfully', 201);
  } catch (err) {
    if (err.code === 11000) return response.error(res, 'Email already registered', 409);
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    response.success(res, result, 'Login successful');
  } catch (err) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return response.error(res, 'Invalid email or password', 401);
    }
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return response.error(res, 'Refresh token required', 400);

  try {
    const result = await authService.refreshSession(refreshToken);
    response.success(res, result);
  } catch (err) {
    response.error(res, err.message, 401);
  }
};

export const verify = (req, res) => {
  response.success(res, { valid: true, decoded: req.user });
};

export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    await authService.logoutUser(req.user.id, token);
  } catch {}
  response.success(res, { success: true }, 'Logged out');
};

export default {
  signup,
  login,
  refresh,
  verify,
  logout
};
