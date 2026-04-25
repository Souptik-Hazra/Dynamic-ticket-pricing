import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import bus from '../../shared/InternalBus.js';

const router = express.Router();
dotenv.config();

// ── Event Bus Subscriptions ───────────────────────────────────────────────

bus.subscribe('payment.success', (payload) => {
  const { userEmail, amount, eventName, venue, startDate, bookingReference, categoryName, quantity } = payload;
  sendEmail(userEmail, 'ticket_confirmation', {
    customerName: payload.userName || 'Valued Customer',
    eventName,
    venue,
    startDate,
    bookingReference,
    categoryName,
    quantity,
    totalAmount: amount
  });
});

// ── SMTP transporter ──────────────────────────────────────────────────────
let smtpReady = false;
let smtpError = null;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  pool: true,
  maxConnections: 5,
  connectionTimeout: 10000,
});

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter.verify((err) => {
    if (err) {
      smtpError = err.message;
      console.error('[EmailModule] SMTP verification failed:', err.message);
    } else {
      smtpReady = true;
      console.log('✅ [Email] SMTP connection verified');
    }
  });
}

// ── Email templates ───────────────────────────────────────────────────────
const templates = {
  ticket_confirmation: (data) => ({
    subject: `🎫 Your Ticket Confirmed — ${data.eventName}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;padding:20px;border-radius:10px">
        <h2 style="color:#2ecc71">Booking Confirmed! 🎉</h2>
        <p>Hi <strong>${data.customerName}</strong>,</p>
        <p>Your tickets for <strong>${data.eventName}</strong> are confirmed.</p>
        <table style="border-collapse:collapse;width:100%;margin:20px 0">
          <tr style="background:#f9f9f9"><td><strong>Booking Ref:</strong></td><td>${data.bookingReference}</td></tr>
          <tr><td><strong>Event:</strong></td><td>${data.eventName}</td></tr>
          <tr style="background:#f9f9f9"><td><strong>Venue:</strong></td><td>${data.venue}</td></tr>
          <tr><td><strong>Date:</strong></td><td>${data.startDate}</td></tr>
          <tr style="background:#f9f9f9"><td><strong>Quantity:</strong></td><td>${data.quantity}</td></tr>
          <tr><td><strong>Total Paid:</strong></td><td>₹${data.totalAmount}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;text-align:center">Keep this email as your booking record. Enjoy the event!</p>
      </div>`,
  }),
  subscription_upgrade: (data) => ({
    subject: `✅ Subscription Upgraded — ${data.plan?.replace(/_/g, ' ')}`,
    html: `<h3>Hi ${data.name},</h3><p>Your subscription has been successfully upgraded to <strong>${data.plan?.replace(/_/g, ' ')}</strong>.</p><p>Valid until: ${data.endDate}</p>`,
  }),
  price_alert: (data) => ({
    subject: `📊 Price Update for ${data.eventName}`,
    html: `<p>Dynamic pricing for <strong>${data.eventName}</strong> has changed. New baseline: ₹${data.prices?.base || 'N/A'}</p>`,
  }),
  password_reset: (data) => ({
    subject: '🔑 Password Reset Request',
    html: `<p>Hi ${data.name}, use this code to reset your password: <strong style="font-size:20px;letter-spacing:2px">${data.code}</strong>. Expires in 15 minutes.</p>`,
  }),
};

// ── Shared Export for Internal Modules ─────────────────────────────────────
export const sendEmail = async (to, templateName, data) => {
  try {
    const templateFn = templates[templateName];
    if (!templateFn) return console.warn(`[EmailModule] Unknown template: ${templateName}`);
    
    if (!smtpReady) return console.warn(`[EmailModule] Skip sending to ${to} (SMTP not ready)`);

    const { subject, html } = templateFn(data || {});
    await transporter.sendMail({
      from: `"FanFever" <${process.env.SMTP_USER}>`,
      to, subject, html
    });
  } catch (err) {
    console.error('[EmailModule] Send failed:', err.message);
  }
};

// ── API Routes ────────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status: 'ok', smtpReady, smtpError, timestamp: new Date().toISOString() }));

router.post('/send-template', async (req, res) => {
  const { to, templateName, data } = req.body;
  if (!to || !templateName) return res.status(400).json({ error: 'to and templateName are required' });
  
  await sendEmail(to, templateName, data);
  res.json({ message: 'Email request accepted' });
});

export default router;
