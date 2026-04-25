import Ledger from '../model/ledger.model.js';
import User from '../../users/model/user.model.js';
import mongoose from 'mongoose';

/**
 * 💳 Expert Wallet Service (Double-Entry)
 * 
 * Handles all financial movements with ACID compliance
 * and immutable ledger records.
 */

export const adjustBalance = async (userId, amount, category, referenceId, description = '') => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Get current balance (for the ledger audit)
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error('USER_NOT_FOUND');

    const currentBalance = user.walletBalance || 0;
    const newBalance = currentBalance + amount;

    if (newBalance < 0) throw new Error('INSUFFICIENT_FUNDS');

    // 2. Update User Balance
    await User.updateOne(
      { _id: userId },
      { $inc: { walletBalance: amount } },
      { session }
    );

    // 3. Create Ledger Entry
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
    return newBalance;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export default { adjustBalance };
