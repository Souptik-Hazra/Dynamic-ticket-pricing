import express from 'express';
import { requireDB } from '../../shared/database.js';
import authMiddleware, { requireRole } from '../../middleware/auth.js';
import { getDashboardStats } from './analytics.utils.js';
import SystemLog from '../../shared/models/SystemLog.js';

const router = express.Router();

router.get('/dashboard', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const stats = await getDashboardStats(req.user.id, req.user.role, req.query.nocache === 'true');
    res.json(stats);
  } catch (err) { next(err); }
});

router.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'analytics-module',
    timestamp: new Date().toISOString()
  });
});

// ── System Logs ────────────────────────────────────────────────────────────

router.get('/system-logs', requireDB, async (req, res, next) => {
  try {
    const logs = await SystemLog.find().sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (err) { next(err); }
});

router.post('/system-logs', requireDB, async (req, res, next) => {
  try {
    const log = await SystemLog.create({
      ...req.body,
      timestamp: new Date()
    });
    res.status(201).json(log);
  } catch (err) { next(err); }
});

// ── System Health ──────────────────────────────────────────────────────────

router.get('/system-health', requireDB, async (req, res, next) => {
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const [serviceDistribution, errorTimeline] = await Promise.all([
      SystemLog.aggregate([
        { $match: { timestamp: { $gte: twentyFourHoursAgo } } },
        { $group: { _id: '$service', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      SystemLog.aggregate([
        { $match: { timestamp: { $gte: twentyFourHoursAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d %H:00", date: "$timestamp" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      serviceDistribution: serviceDistribution.map(s => ({ name: s._id, value: s.count })),
      errorTimeline: errorTimeline.map(t => ({ 
        time: t._id.replace(' ', 'T') + ':00Z', 
        errors: t.count 
      }))
    });
  } catch (err) { next(err); }
});

export default router;
