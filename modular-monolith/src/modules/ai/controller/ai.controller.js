import * as aiService from '../service/ai.service.js';

export const getPrices = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const score = parseFloat(req.query.score || '1.0');
    const result = await aiService.predictEventPrices(eventId, score);
    res.json(result);
  } catch (err) { next(err); }
};

export const syncFederated = async (req, res, next) => {
  try {
    const { weights, reputation } = req.body;
    await aiService.processFederatedSync(req.user.id, weights, reputation);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const aggregateFederated = async (req, res, next) => {
  try {
    const result = await aiService.runFederatedAggregation();
    res.json(result);
  } catch (err) { next(err); }
};

export const health = async (req, res) => {
  const status = await aiService.getAiHealth();
  res.json(status);
};

export default {
  getPrices,
  syncFederated,
  aggregateFederated,
  health
};
