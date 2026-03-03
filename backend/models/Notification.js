const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  time: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  group: { type: String },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  scheduledFor: { type: Date },
});

module.exports = mongoose.model('Notification', notificationSchema);
