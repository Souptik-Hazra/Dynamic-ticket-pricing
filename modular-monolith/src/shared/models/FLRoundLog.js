import mongoose from 'mongoose';

const flRoundLogSchema = new mongoose.Schema({
  roundNumber: { type: Number, required: true, unique: true },
  timestamp: { type: Date, default: Date.now },
  participantsCount: { type: Number, required: true, default: 0 },
  rejectedSubmissions: { type: Number, default: 0 },
  aggregatedWeightsNorm: { type: Number, required: true },
  modelVersion: { type: String, required: true },
  weightsHash: { type: String, required: true },
  clippingThreshold: { type: Number, required: true },
  dpEpsilon: { type: Number, default: null },
  participantDetails: [{ nodeId: String, reputationScore: Number, l2NormBeforeClip: Number, anomalyFlags: [String] }]
});

flRoundLogSchema.index({ roundNumber: -1 });
flRoundLogSchema.index({ modelVersion: 1 });

const FLRoundLog = mongoose.models.FLRoundLog || mongoose.model('FLRoundLog', flRoundLogSchema);
export default FLRoundLog;
