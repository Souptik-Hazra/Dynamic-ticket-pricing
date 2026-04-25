import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
  service: { type: String, required: true, index: true },
  level: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'], default: 'INFO', index: true },
  message: { type: String, required: true },
  stack: String,
  traceId: { type: String, index: true },
  context: { method: String, url: String, statusCode: Number, userId: mongoose.Schema.Types.ObjectId, ip: String },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: false });

systemLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', systemLogSchema);
export default SystemLog;
