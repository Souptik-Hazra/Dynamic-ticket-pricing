import Payment from '../model/payment.model.js';
import Wallet from '../model/wallet.model.js';

export const createPayment = async (data) => {
  return await Payment.create(data);
};

export const findPaymentsByUser = async (userId) => {
  return await Payment.find({ userId }).sort({ createdAt: -1 });
};

export const findPaymentById = async (id) => {
  return await Payment.findById(id);
};

export const findWalletByUser = async (userId) => {
  return await Wallet.findOne({ userId });
};

export const findWalletById = async (id) => {
  return await Wallet.findById(id);
};

export const createWallet = async (userId) => {
  return await Wallet.create({ userId, balance: 0, transactions: [] });
};

export const updateWalletBalance = async (userId, amount, type, description, options = { new: true, upsert: true }) => {
  const filter = { userId };
  
  // CONCURRENCY FIX: Prevent negative balance on deductions
  if (amount < 0) {
    filter.balance = { $gte: Math.abs(amount) };
  }

  return await Wallet.findOneAndUpdate(
    filter,
    { 
      $inc: { balance: amount },
      $push: { transactions: { amount: Math.abs(amount), type, description, timestamp: new Date() } }
    },
    options
  );
};

export const findOne = async (filter) => {
  return await Payment.findOne(filter);
};

export const listAllWallets = async () => {
  return await Wallet.find().populate('userId', 'name email');
};

export default {
  createPayment,
  findPaymentsByUser,
  findPaymentById,
  findOne,
  findWalletByUser,
  findWalletById,
  createWallet,
  updateWalletBalance,
  listAllWallets
};
