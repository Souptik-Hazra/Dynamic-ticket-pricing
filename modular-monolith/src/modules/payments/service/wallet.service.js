import Ledger from '../model/ledger.model.js';
import { userService } from '../../users/index.js';
import paymentRepo from '../repository/payment.repo.js';
import mongoose from 'mongoose';
import { logInfo, logWarn, logError } from '../../../shared/utils/logger.js';

/**
 * 💳 Expert Wallet Service (Double-Entry)
 * 
 * Handles all financial movements with ACID compliance
 * and immutable ledger records.
 */

export const adjustBalance = async (userId, amount, category, referenceId, description = '') => {
  const session = await mongoose.startSession();
  session.startTransaction();
  logInfo('WalletService', 'Starting wallet adjustment', { userId, amount, category, referenceId });

  try {
    // Update User Balance via User Module
    // This handles both getting current balance and updating it atomically if using $inc
    const newBalance = await userService.updateWalletBalance(userId, amount, session);

    if (newBalance < 0) {
      logWarn('WalletService', 'Insufficient funds for adjustment', { userId, amount, balanceAfter: newBalance });
      throw new Error('INSUFFICIENT_FUNDS');
    }

    // Create Ledger Entry
    await Ledger.create([{
      userId,
      amount,
      type: amount >= 0 ? 'CREDIT' : 'DEBIT',
      category,
      balanceAfter: newBalance,
      referenceId,
      description
    }], { session });

    await session.commitTransaction();
    logInfo('WalletService', 'Wallet adjustment committed', { userId, balanceAfter: newBalance });
    return newBalance;
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    logError('WalletService', 'Wallet adjustment failed', err, { userId, amount, category, referenceId });
    throw err;
  } finally {
    await session.endSession();
  }
};

export const findWalletById = (id) => paymentRepo.findWalletById(id);
export const updateWalletBalance = (userId, amount, type, description, options) =>
  paymentRepo.updateWalletBalance(userId, amount, type, description, options);
export const listAllWallets = () => paymentRepo.listAllWallets();

export default { adjustBalance, findWalletById, updateWalletBalance, listAllWallets };
