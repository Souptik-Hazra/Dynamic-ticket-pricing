import * as emailService from '../service/email.service.js';

export const health = (req, res) => {
  const status = emailService.getStatus();
  res.json({ status: 'ok', ...status, timestamp: new Date().toISOString() });
};

export const sendTemplate = async (req, res) => {
  const { to, templateName, data } = req.body;
  if (!to || !templateName) return res.status(400).json({ error: 'to and templateName are required' });
  
  await emailService.sendEmail(to, templateName, data);
  res.json({ message: 'Email request accepted' });
};

export default {
  health,
  sendTemplate
};
