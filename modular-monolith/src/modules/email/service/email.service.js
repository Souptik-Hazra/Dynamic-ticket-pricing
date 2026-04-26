import nodemailer from 'nodemailer';
import config from '../../../shared/config/index.js';
import bus from '../../../shared/utils/bus.js';
import { emailQueue } from '../../../shared/utils/taskQueue.js';

let smtpReady = false;
let smtpError = null;

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
  pool: true,
  maxConnections: 5,
  connectionTimeout: 10000,
});

if (config.smtp.host && config.smtp.user) {
  transporter.verify((err) => {
    if (err) {
      smtpError = err.message;
      console.error('[EmailService] SMTP verification failed:', err.message);
    } else {
      smtpReady = true;
      console.log('✅ [Email] SMTP connection verified');
    }
  });
}

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
        ${data.qrCode ? `
        <div style="text-align:center;margin:30px 0;padding:20px;background:#f0f0f0;border-radius:10px">
          <p style="margin-bottom:10px;font-weight:bold">Your Entry Pass (Scan at Venue)</p>
          <img src="${data.qrCode}" alt="Ticket QR" style="width:180px;height:180px;border:10px solid #white" />
        </div>
        ` : ''}
        <p style="color:#888;font-size:12px;text-align:center">Keep this email as your booking record. Enjoy the event!</p>
      </div>`,
  }),
  subscription_upgrade: (data) => ({
    subject: `✅ Subscription Upgraded — ${data.planName}`,
    html: `<h3>Hi ${data.customerName},</h3><p>Your subscription has been successfully upgraded to <strong>${data.planName}</strong>.</p><p>Valid until: ${data.expiryDate}</p>`,
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

export const sendEmail = async (to, templateName, data) => {
  emailQueue.add(`SendEmail:${templateName}`, async () => {
    try {
      const templateFn = templates[templateName];
      if (!templateFn) return console.warn(`[EmailService] Unknown template: ${templateName}`);
      
      if (!smtpReady) throw new Error('SMTP_NOT_READY');

      const { subject, html } = templateFn(data || {});
      await transporter.sendMail({
        from: `"FanFever" <${config.smtp.user}>`,
        to, subject, html
      });
    } catch (err) {
      console.error('[EmailService] Send failed:', err.message);
      throw err; // Re-throw for Queue retry logic
    }
  });
};

export const getStatus = () => ({ smtpReady, smtpError });

// Event Bus Subscriptions
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
    totalAmount: amount,
    qrCode: payload.qrCode
  });
});

bus.subscribe('subscription.upgraded', (payload) => {
  const { userEmail, userName, planLabel, expiryStr } = payload;
  sendEmail(userEmail, 'subscription_upgrade', {
    customerName: userName || 'Valued Member',
    planName: planLabel,
    expiryDate: expiryStr
  });
});

export default { sendEmail, getStatus };
