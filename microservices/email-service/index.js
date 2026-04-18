// Email Service Entry Point
import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

app.post('/api/email/send', async (req, res) => {
  const { to, subject, text, html } = req.body;
  try {
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, text, html });
    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'email-service', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4007;
app.listen(PORT, () => {
  console.log(`Email Service running on port ${PORT}`);
});
