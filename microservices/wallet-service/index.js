import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB, { requireDB, registerProcessHandlers } from '../shared/db.js';
import { errorHandler, notFound } from '../shared/errorHandler.js';
import jwtMiddleware from '../shared/jwtMiddleware.js';
import Wallet from '../shared/models/Wallet.js';
import { notify, wsNotifyUser } from '../shared/interservice.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB('WalletService');

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'wallet-service', ts: new Date().toISOString() })
);

/**
 * GET /api/wallet/balance
 * Returns the current user's balance and history.
 */
app.get('/api/wallet/balance', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      // Lazy initialization
      wallet = await Wallet.create({ userId: req.user.id, balance: 0, transactions: [] });
    }
    res.json({ balance: wallet.balance, transactions: wallet.transactions.slice(-20).reverse() });
  } catch (err) { next(err); }
});

/**
 * POST /api/wallet/deposit
 * User: Add money to own wallet
 */
app.post('/api/wallet/deposit', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const wallet = await Wallet.findOneAndUpdate(
      { userId: req.user.id },
      { 
        $inc: { balance: amount },
        $push: { transactions: { amount, type: 'credit', description: 'Deposit via Dashboard' } } 
      },
      { new: true, upsert: true }
    );


    res.json({ success: true, newBalance: wallet.balance });

    // ── Inter-service: notify user ──
    notify(req.user.id, 'system', '💳 Money Added', `₹${amount} deposited via dashboard.`);
    wsNotifyUser(req.user.id, 'system', '💳 Wallet Updated', `₹${amount} added successfully.`);
  } catch (err) { next(err); }
});

/**
 * POST /api/wallet/withdraw
 * User: Remove money from own wallet
 */
app.post('/api/wallet/withdraw', jwtMiddleware, requireDB, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance for withdrawal' });
    }

    wallet.balance -= amount;
    wallet.transactions.push({ amount, type: 'debit', description: 'Withdrawal to Bank' });
    await wallet.save();


    res.json({ success: true, newBalance: wallet.balance });

    // ── Inter-service: notify user ──
    notify(req.user.id, 'system', '💸 Money Withdrawn', `₹${amount} withdrawn to your bank account.`);
    wsNotifyUser(req.user.id, 'system', '💸 Withdrawal Success', `₹${amount} withdrawn successfully.`);
  } catch (err) { next(err); }
});

/**
 * POST /api/wallet/credit
 * Internal: Add funds (e.g., from refund)
 */
app.post('/api/wallet/credit', requireDB, async (req, res, next) => {
  try {
    const { userId, amount, description } = req.body;
    if (!userId || !amount) return res.status(400).json({ error: 'userId and amount required' });

    const wallet = await Wallet.findOneAndUpdate(
      { userId },
      { 
        $inc: { balance: amount },
        $push: { transactions: { amount, type: 'credit', description: description || 'Refund' } } 
      },
      { new: true, upsert: true }
    );


    res.json({ success: true, newBalance: wallet.balance });

    // ── Inter-service: notify user ──
    notify(userId, 'refund', '💰 Fast Refund', `₹${amount} credited: ${description || 'Refund'}`);
    wsNotifyUser(userId, 'refund', '💰 Refund Received', `₹${amount} has been added to your wallet.`);
  } catch (err) { next(err); }
});

/**
 * POST /api/wallet/debit
 * Internal/User: Remove funds
 */
app.post('/api/wallet/debit', requireDB, async (req, res, next) => {
  try {
    const { userId: bodyUserId, amount, description, internal } = req.body;
    
    let userId = bodyUserId;
    
    // If not internal, require JWT
    if (!internal) {
      return jwtMiddleware(req, res, () => {
        userId = req.user.id;
        processDebit(userId, amount, description, res, next);
      });
    }

    processDebit(userId, amount, description, res, next);
  } catch (err) { next(err); }
});

async function processDebit(userId, amount, description, res, next) {
  try {
    if (!userId || !amount || amount <= 0) return res.status(400).json({ error: 'Valid userId and amount required' });

    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    wallet.balance -= amount;
    wallet.transactions.push({ amount, type: 'debit', description: description || 'Purchase' });
    await wallet.save();

    res.json({ success: true, newBalance: wallet.balance });
  } catch (err) { next(err); }
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT_WALLET_SERVICE || 4016;
const server = app.listen(PORT, () => console.log(`Wallet Service running on port ${PORT}`));
registerProcessHandlers(server, 'WalletService');
