import PriceLog from '../model/priceLog.model.js';
import FLRoundLog from '../model/flRoundLog.model.js';

export const logPrice = async (data) => {
  return await PriceLog.create(data);
};

export const createFLRoundLog = async (data) => {
  return await FLRoundLog.create(data);
};

export const countFLRounds = async () => {
  return await FLRoundLog.countDocuments();
};

export const clearFLHistory = async () => {
  return await FLRoundLog.deleteMany({});
};

export default {
  logPrice,
  createFLRoundLog,
  countFLRounds,
  clearFLHistory
};
