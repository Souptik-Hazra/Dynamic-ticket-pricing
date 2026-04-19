import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import { registerProcessHandlers, tuneExpressServer } from '../shared/db.js';

dotenv.config();

const app = express();
app.use(compression());
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS || '').split(','),
  credentials: true,
}));
app.use(express.json());

// ── SMTP transporter ──────────────────────────────────────────────────────
let smtpReady  = false;
let smtpError  = null;

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth:   {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Connection pool + timeouts
  pool:                  true,
  maxConnections:        5,
  maxMessages:           100,
  connectionTimeout:     10000, // 10s to establish connection
  greetingTimeout:       5000,  // 5s for SMTP greeting
  socketTimeout:         30000, // 30s per socket op
});

// Verify SMTP connection at startup (non-blocking)
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter.verify((err) => {
    if (err) {
      smtpError = err.message;
      console.error('[Email] SMTP verification failed:', err.message);
    } else {
      smtpReady = true;
      console.log('[Email] SMTP connection verified');
    }
  });
} else {
  smtpError = 'SMTP credentials not configured (check .env: SMTP_HOST, SMTP_USER, SMTP_PASS)';
  console.warn('[Email]', smtpError);
}

// ── Email templates ───────────────────────────────────────────────────────
const templates = {
  ticket_confirmation: (data) => ({
    subject: `🎫 Your Ticket Confirmed — ${data.eventName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Booking Confirmed! 🎉</h2>
        <p>Hi <strong>${data.customerName}</strong>,</p>
        <p>Your tickets for <strong>${data.eventName}</strong> are confirmed.</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td><strong>Booking Ref:</strong></td><td>${data.bookingReference}</td></tr>
          <tr><td><strong>Event:</strong></td><td>${data.eventName}</td></tr>
          <tr><td><strong>Venue:</strong></td><td>${data.venue}</td></tr>
          <tr><td><strong>Date:</strong></td><td>${data.startDate}</td></tr>
          <tr><td><strong>Category:</strong></td><td>${data.categoryName}</td></tr>
          <tr><td><strong>Quantity:</strong></td><td>${data.quantity}</td></tr>
          <tr><td><strong>Total Paid:</strong></td><td>₹${data.totalAmount}</td></tr>
        </table>
        <p style="color:#888;font-size:12px">Keep this email as your booking record.</p>
      </div>`,
  }),
  subscription_upgrade: (data) => ({
    subject: `✅ Subscription Upgraded — ${data.plan.replace(/_/g, ' ')}`,
    html: `<p>Hi ${data.name}, your subscription is now <strong>${data.plan.replace(/_/g, ' ')}</strong>. Expires: ${data.endDate}</p>`,
  }),
  price_alert: (data) => ({
    subject: `📊 Price Update for ${data.eventName}`,
    html: `<p>Dynamic pricing for <strong>${data.eventName}</strong> has changed. New prices: ${JSON.stringify(data.prices)}</p>`,
  }),
  password_reset: (data) => ({
    subject: '🔑 Password Reset Request',
    html: `<p>Hi ${data.name}, use this code to reset your password: <strong>${data.code}</strong>. Expires in 15 minutes.</p>`,
  }),
};

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'email-service', smtpReady, smtpError, ts: new Date().toISOString() })
);

// ── POST /api/email/send — send a raw email ───────────────────────────────
app.post('/api/email/send', async (req, res, next) => {
  try {
    if (!smtpReady)
      return res.status(503).json({ error: 'Email service unavailable', reason: smtpError });

    const { to, subject, text, html } = req.body;
    if (!to)      return res.status(400).json({ error: 'to (recipient email) is required' });
    if (!subject) return res.status(400).json({ error: 'subject is required' });
    if (!text && !html) return res.status(400).json({ error: 'Either text or html body is required' });

    const info = await transporter.sendMail({
      from:    `"Dynamic Tickets" <${process.env.SMTP_USER}>`,
      to, subject, text, html,
    });

    res.json({ message: 'Email sent', messageId: info.messageId });
  } catch (err) { next(err); }
});

// ── POST /api/email/send-template — send a named template ─────────────────
app.post('/api/email/send-template', async (req, res, next) => {
  try {
    if (!smtpReady)
      return res.status(503).json({ error: 'Email service unavailable', reason: smtpError });

    const { to, templateName, data } = req.body;
    if (!to)           return res.status(400).json({ error: 'to is required' });
    if (!templateName) return res.status(400).json({ error: 'templateName is required' });

    const templateFn = templates[templateName];
    if (!templateFn)
      return res.status(400).json({
        error: `Unknown template '${templateName}'`,
        available: Object.keys(templates),
      });

    const { subject, html } = templateFn(data || {});
    const info = await transporter.sendMail({
      from:    `"Dynamic Tickets" <${process.env.SMTP_USER}>`,
      to, subject, html,
    });

    res.json({ message: 'Email sent', messageId: info.messageId, template: templateName });
  } catch (err) { next(err); }
});

// ── 404 + Error handlers ──────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT_EMAIL_SERVICE || 4007;
const server = app.listen(PORT, () => console.log(`Email Service running on port ${PORT}`));
registerProcessHandlers(server, 'EmailService');
tuneExpressServer(server);
