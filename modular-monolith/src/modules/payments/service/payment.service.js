import mongoose from 'mongoose';
import bus from '../../../shared/utils/bus.js';
import { invalidateEventCache } from '../../../shared/utils/cache.js';
import { logInfo, logWarn, logError } from '../../../shared/utils/logger.js';
import paymentRepo from '../repository/payment.repo.js';

// Decoupled Module Interfaces
import { ticketService } from '../../tickets/index.js';
import { catalogService } from '../../catalog/index.js';
import { userService } from '../../users/index.js';
import { ROLES } from '../../../shared/constants/roles.js';

export const processTicketPayment = async (userId, data, userDetails) => {
  const { ticketId, paymentMethod, metadata } = data;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const paymentTicketIds = Array.isArray(metadata?.ticketIds) ? metadata.ticketIds : [ticketId];
    const tickets = await ticketService.findWithEvent({ _id: { $in: paymentTicketIds } });

    if (tickets.length === 0) throw new Error('TICKETS_NOT_FOUND');

    // IDEMPOTENCY CHECK
    const existingPayment = await paymentRepo.findOne({ bookingReference: tickets[0].bookingReference, status: 'completed' });
    if (existingPayment) {
      logWarn('PaymentService', 'Duplicate payment detected; returning existing payment', { userId, bookingReference: tickets[0].bookingReference });
      return existingPayment;
    }

    const payableAmount = tickets.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);
    logInfo('PaymentService', 'Processing ticket payment', {
      userId,
      paymentMethod,
      ticketCount: tickets.length,
      payableAmount,
      bookingReference: tickets[0].bookingReference
    });

    // 1. Handle Wallet Transaction
    if (paymentMethod === 'wallet') {
      const wallet = await paymentRepo.updateWalletBalance(userId, -payableAmount, 'debit', `Tickets purchase: ${tickets[0].bookingReference}`, { session, new: true });
      if (!wallet) {
        logWarn('PaymentService', 'Insufficient wallet balance', { userId, payableAmount });
        throw new Error('INSUFFICIENT_BALANCE');
      }
    }

    // 2. Create Payment Record
    const payment = await paymentRepo.createPayment([{
      ticketId: tickets[0]._id,
      eventId: tickets[0].eventId._id,
      userId,
      amount: payableAmount,
      bookingReference: tickets[0].bookingReference,
      paymentMethod,
      status: 'completed',
      metadata: { ...metadata, ticketIds: paymentTicketIds }
    }], { session });

    // 3. Confirm Tickets
    await ticketService.updateStatus(
      { _id: { $in: paymentTicketIds } },
      'confirmed',
      { session }
    );

    // 4. Update Event Revenue & Commissions
    const commission = Math.round(payableAmount * 0.20);
    const organizerNet = payableAmount - commission;

    await catalogService.updateInventory(
      { _id: tickets[0].eventId._id },
      { $inc: { totalRevenue: payableAmount, commissionCollected: commission } },
      { session }
    );

    // 5. Admin & Organizer Wallet Updates
    const admin = await userService.findOne({ role: ROLES.ADMIN });
    if (admin) {
      await paymentRepo.updateWalletBalance(admin._id, commission, 'credit', `Commission from ${tickets[0].bookingReference}`, { session, upsert: true });
    }

    if (tickets[0].eventId.organizerId) {
      await paymentRepo.updateWalletBalance(tickets[0].eventId.organizerId, organizerNet, 'credit', `Revenue from ${tickets[0].bookingReference}`, { session, upsert: true });
    }

    await session.commitTransaction();

    // 6. Emit Success Event
    bus.publish('payment.success', {
      userId,
      userName: userDetails.name,
      userEmail: userDetails.email,
      amount: payableAmount,
      eventName: tickets[0].eventId.name,
      venue: tickets[0].eventId.venue,
      startDate: new Date(tickets[0].eventId.startDate).toLocaleDateString(),
      bookingReference: tickets[0].bookingReference,
      categoryName: tickets[0].categoryName || 'General',
      quantity: tickets.reduce((sum, t) => sum + (t.quantity || 1), 0),
      qrCode: tickets[0].qrCode
    });

    logInfo('PaymentService', 'Ticket payment processed successfully', {
      userId,
      bookingReference: tickets[0].bookingReference,
      amount: payableAmount,
      ticketCount: tickets.length,
      paymentMethod
    });

    return payment[0];
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    logError('PaymentService', 'Ticket payment failed', err, { userId, paymentMethod });
    throw err;
  } finally {
    await session.endSession();
  }
};

export const processRefund = async (paymentId) => {
  logInfo('PaymentService', 'Starting refund', { paymentId });
  const payment = await paymentRepo.findPaymentById(paymentId);
  if (!payment || payment.status !== 'completed') {
    logWarn('PaymentService', 'Refund failed due to invalid payment', { paymentId });
    throw new Error('INVALID_PAYMENT');
  }

  const refundAmount = Math.round(payment.amount * 0.85);
  const commissionRefund = Math.round(payment.amount * 0.20);

  payment.status = 'refunded';
  await payment.save();

  const ticketIds = Array.isArray(payment.metadata?.ticketIds) ? payment.metadata.ticketIds : [payment.ticketId];
  const tickets = await ticketService.findMany({ _id: { $in: ticketIds } });
  await ticketService.updateStatus({ _id: { $in: ticketIds } }, 'refunded');

  const event = await catalogService.findById(payment.eventId);
  if (event) {
    const quantity = tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
    event.availableTickets = Math.min(event.capacity, (event.availableTickets || 0) + quantity);
    event.ticketsSold = Math.max(0, (event.ticketsSold || 0) - quantity);
    event.totalRevenue = Math.max(0, (event.totalRevenue || 0) - payment.amount);
    event.commissionCollected = Math.max(0, (event.commissionCollected || 0) - commissionRefund);

    for (const t of tickets) {
      const cat = event.ticketCategories.find(c => c.name === t.categoryName);
      if (cat) {
        cat.availableSeats = Math.min(cat.seats, (cat.availableSeats || 0) + (t.quantity || 1));
        if (t.seatNumber) cat.bookedSeats = (cat.bookedSeats || []).filter(s => s !== t.seatNumber);
      }
    }
    await event.save();
    await invalidateEventCache(event._id);
  }

  await paymentRepo.updateWalletBalance(payment.userId, refundAmount, 'credit', `Refund (85%) for ${payment.bookingReference}`);

  logInfo('PaymentService', 'Refund amount credited back to user', {
    paymentId,
    userId: payment.userId,
    refundAmount
  });

  const organizerClawback = Math.round(payment.amount * 0.80);
  if (event && event.organizerId) {
    await paymentRepo.updateWalletBalance(event.organizerId, -organizerClawback, 'debit', `Refund Clawback for ${payment.bookingReference}`);
  }

  bus.publish('system.alert', {
    userId: payment.userId,
    title: '💸 Refund Processed',
    message: `₹${refundAmount} (85%) refunded for ${payment.bookingReference}`
  });

  logInfo('PaymentService', 'Refund processed successfully', { paymentId, refundAmount });
  return refundAmount;
};

export const getWalletBalance = async (userId) => {
  let wallet = await paymentRepo.findWalletByUser(userId);
  if (!wallet) wallet = await paymentRepo.createWallet(userId);
  return { balance: wallet.balance, transactions: wallet.transactions.slice(-20).reverse() };
};

export const depositFunds = async (userId, amount) => {
  logInfo('PaymentService', 'Depositing funds', { userId, amount });
  const wallet = await paymentRepo.updateWalletBalance(userId, Number(amount), 'credit', 'Funds deposited');
  bus.publish('system.alert', { userId, title: '💳 Money Added', message: `₹${amount} deposited successfully.` });
  logInfo('PaymentService', 'Deposit completed', { userId, amount, balance: wallet.balance });
  return wallet.balance;
};

export const withdrawFunds = async (userId, amount) => {
  logInfo('PaymentService', 'Withdrawing funds', { userId, amount });
  const wallet = await paymentRepo.findWalletByUser(userId);
  if (!wallet || wallet.balance < amount) {
    logWarn('PaymentService', 'Withdrawal failed due to insufficient balance', { userId, amount, balance: wallet?.balance });
    throw new Error('INSUFFICIENT_BALANCE');
  }

  const updatedWallet = await paymentRepo.updateWalletBalance(userId, -Number(amount), 'debit', 'Withdrawal to Bank');
  bus.publish('system.alert', { userId, title: '💸 Money Withdrawn', message: `₹${amount} withdrawn successfully.` });
  logInfo('PaymentService', 'Withdrawal completed successfully', { userId, amount, balance: updatedWallet.balance });
  return updatedWallet.balance;
};

export default {
  processTicketPayment,
  processRefund,
  getWalletBalance,
  depositFunds,
  withdrawFunds
};
