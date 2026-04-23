import mongoose from 'mongoose';

const flRoundLogSchema = new mongoose.Schema({
  roundNumber: {
    type: Number,
    required: true,
    unique: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  participantsCount: {
    type: Number,
    required: true,
    default: 0
  },
  rejectedSubmissions: {
    type: Number,
    default: 0
  },
  aggregatedWeightsNorm: {
    type: Number,
    required: true
  },
  modelVersion: {
    type: String,
    required: true
  },
  // We can store a cryptographic hash of the aggregated weights to ensure tamper-evidence
  weightsHash: {
    type: String,
    required: true
  },
  // The threshold used for clipping L2 norms
  clippingThreshold: {
    type: Number,
    required: true
  },
  // DP noise scale added (if any)
  dpEpsilon: {
    type: Number,
    default: null
  },
  // Track specific participant IDs (anonymized/hashed) and their assigned reputations
  participantDetails: [{
    nodeId: String,
    reputationScore: Number,
    l2NormBeforeClip: Number,
    anomalyFlags: [String]
  }]
});

// Indexing for faster queries on version and round
flRoundLogSchema.index({ roundNumber: -1 });
flRoundLogSchema.index({ modelVersion: 1 });

const FLRoundLog = mongoose.model('FLRoundLog', flRoundLogSchema);

export default FLRoundLog;
