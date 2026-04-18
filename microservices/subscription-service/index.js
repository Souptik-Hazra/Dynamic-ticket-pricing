import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Subscription, { PLAN_DURATIONS_DAYS } from '../shared/models/Subscription.js';
import User from '../shared/models/User.js';
import { notify, wsNotifyUser, sendEmailTemplate } from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB('SubscriptionService');

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'subscription-service', ts: new Date().toISOString() })
);

// GET current subscription
app.get('/api/subscription', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({ userId: req.user.id });
    if (!sub) return res.json({ plan: 'none', isActive: false });

    // Auto-expire if past endDate
    if (sub.isActive && sub.endDate < new Date()) {
      sub.isActive = false;
      await sub.save();

      // Notify user that subscription expired
      notify(
        req.user.id,
        'subscription',
        '⚠️ Subscription Expired',
        `Your ${sub.plan.replace(/_/g, ' ')} plan has expired. Renew to keep your benefits.`
      );
    }
    res.json(sub);
  } catch (err) { next(err); }
});

// POST upgrade plan
app.post('/api/subscription/upgrade', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan is required' });

    const durationDays = PLAN_DURATIONS_DAYS[plan];
    if (!durationDays) {
      return res.status(400).json({
        error:      `Invalid plan '${plan}'`,
        validPlans: Object.keys(PLAN_DURATIONS_DAYS),
      });
    }

    const now     = new Date();
    const endDate = new Date(now.getTime() + durationDays * 86400000);

    const subscription = await Subscription.findOneAndUpdate(
      { userId: req.user.id },
      { plan, startDate: now, endDate, isActive: true },
      { upsert: true, new: true }
    );

    // Sync snapshot onto User document (so AuthContext.user.subscription stays accurate)
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { subscription: { plan, isActive: true, endDate } },
      { new: true }
    );

    const planLabel = plan.replace(/_/g, ' ');
    const expiryStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // ── Inter-service: notification + email ─────────────────────────────
    // 1. Persistent in-app notification
    notify(
      req.user.id,
      'subscription',
      `⭐ Subscription Activated — ${planLabel}`,
      `Your ${planLabel} plan is now active. Expires on ${expiryStr}.`
    );

    // 2. Real-time WebSocket push
    wsNotifyUser(
      req.user.id,
      'subscription',
      '⭐ Subscription Active!',
      `Your ${planLabel} plan expires on ${expiryStr}.`
    );

    // 3. Confirmation email
    if (user?.email) {
      sendEmailTemplate(user.email, 'subscription_upgrade', {
        name:    user.name,
        plan:    planLabel,
        endDate: expiryStr,
      });
    }

    res.json({ success: true, subscription });
  } catch (err) { next(err); }
});

app.use(notFound);
app.use(errorHandler);

const PORT   = process.env.PORT || 4012;
const server = app.listen(PORT, () => console.log(`Subscription Service running on port ${PORT}`));
registerProcessHandlers(server, 'SubscriptionService');
