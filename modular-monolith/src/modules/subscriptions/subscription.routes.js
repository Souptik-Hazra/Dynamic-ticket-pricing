import express from 'express';
import Subscription, { SUBSCRIPTION_PLANS, getPlanDuration } from '../../shared/models/Subscription.js';
import User from '../../shared/models/User.js';
import { requireDB } from '../../shared/database.js';
import authMiddleware from '../../middleware/auth.js';
import { pushNotification } from '../notifications/notification.routes.js';
import { sendEmail } from '../email/email.routes.js';

const router = express.Router();

router.get('/plans', (_req, res) => res.json(SUBSCRIPTION_PLANS));

router.get('/', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ userId: req.user.id });
    if (!sub) return res.json({ plan: 'none', isActive: false });
    if (sub.isActive && sub.endDate < new Date()) {
      sub.isActive = false;
      await sub.save();
      await pushNotification(req.user.id, { 
        title: '⚠️ Subscription Expired', 
        message: `Your ${sub.plan.replace(/_/g, ' ')} plan has expired. Renew to keep your benefits.`,
        type: 'subscription'
      });
    }
    res.json(sub);
  } catch (err) { next(err); }
});

router.post('/upgrade', authMiddleware, requireDB, async (req, res, next) => {
  try {
    const { plan } = req.body;
    const durationDays = getPlanDuration(plan);
    if (!durationDays) return res.status(400).json({ error: `Invalid plan '${plan}'` });

    const now = new Date();
    const endDate = new Date(now.getTime() + durationDays * 86400000);

    const subscription = await Subscription.findOneAndUpdate(
      { userId: req.user.id },
      { plan, startDate: now, endDate, isActive: true },
      { upsert: true, new: true }
    );

    await User.findByIdAndUpdate(req.user.id, { subscription: { plan, isActive: true, endDate } });

    const planLabel = plan.replace(/_/g, ' ');
    const expiryStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // ── Communications ──
    await pushNotification(req.user.id, { 
      title: '⭐ Subscription Active!', 
      message: `Your ${planLabel} plan is now active until ${expiryStr}.`,
      type: 'subscription'
    });

    await sendEmail(req.user.email, 'subscription_upgrade', {
      customerName: req.user.name || 'Valued Member',
      planName: planLabel,
      expiryDate: expiryStr
    }).catch(() => null);

    res.json({ success: true, subscription });
  } catch (err) { next(err); }
});

export default router;
