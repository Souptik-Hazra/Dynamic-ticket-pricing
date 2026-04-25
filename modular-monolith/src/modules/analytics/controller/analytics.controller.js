import * as analyticsService from '../service/analytics.service.js';

export const getDashboard = async (req, res, next) => {
  try {
    const stats = await analyticsService.getPlatformDashboard(req.user.id, req.user.role, req.query.nocache === 'true');
    res.json(stats);
  } catch (err) { next(err); }
};

export const getLogs = async (req, res, next) => {
  try {
    const logs = await analyticsService.getSystemLogs();
    res.json(logs);
  } catch (err) { next(err); }
};

export const getHealth = async (req, res, next) => {
  try {
    const metrics = await analyticsService.getSystemHealthMetrics();
    res.json(metrics);
  } catch (err) { next(err); }
};

export const status = async (req, res) => {
  res.json({
    status: 'ok',
    service: 'analytics-module',
    timestamp: new Date().toISOString()
  });
};

export default {
  getDashboard,
  getLogs,
  getHealth,
  status
};
