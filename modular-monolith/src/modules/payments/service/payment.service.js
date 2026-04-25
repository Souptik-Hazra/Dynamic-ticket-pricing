import mongoose from 'mongoose';
import bus from '../../../shared/utils/bus.js';
import { cacheDel, cacheDelPattern } from '../../../shared/utils/cache.js';
import paymentRepo from '../repository/payment.repo.js';

// Cross-module service calls
import ticketService from '../../tickets/service/ticket.service.js';
import catalogRepo from '../../catalog/repository/catalog.repo.js';
import userRepo from '../../users/repository/user.repo.js';

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
    if (existingPayment) return existingPayment;

    const payableAmount = tickets.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);

    // 1. Handle Wallet Transaction
    if (paymentMethod === 'wallet') {
      const wallet = await paymentRepo.updateWalletBalance(userId, -payableAmount, 'debit', `Tickets purchase: ${tickets[0].bookingReference}`, { session, new: true });
      if (!wallet) throw new Error('INSUFFICIENT_BALANCE');
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

    await catalogRepo.updateInventory(
      { _id: tickets[0].eventId._id },
      { $inc: { totalRevenue: payableAmount, commissionCollected: commission } },
      { session }
    );

    // 5. Admin & Organizer Wallet Updates
    const admin = await userRepo.findOne({ role: 'admin' });
    if (admin) {
      await paymentRepo.updateWalletBalance(admin._id, commission, 'credit', `Commission from ${tickets[0].bookingReference}`, { session, upsert: true });
    }

    if (tickets[0].eventId.organizerId) {
      await paymentRepo.updateWalletBalance(tickets[0].eventId.organizerId, organizerNet, 'credit', `Revenue from ${tickets[0].bookingReference}`, { session, upsert: true });
    }

    await session.commitTransaction();
    session.endSession();

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

    return payment[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const processRefund = async (paymentId) => {
  const payment = await paymentRepo.findPaymentById(paymentId);
  if (!payment || payment.status !== 'completed') throw new Error('INVALID_PAYMENT');

  const refundAmount = Math.round(payment.amount * 0.85);
  const commissionRefund = Math.round(payment.amount * 0.20);

  payment.status = 'refunded';
  await payment.save();

  const ticketIds = Array.isArray(payment.metadata?.ticketIds) ? payment.metadata.ticketIds : [payment.ticketId];
  const tickets = await ticketService.findMany({ _id: { $in: ticketIds } });
  await ticketService.updateStatus({ _id: { $in: ticketIds } }, 'refunded');

  const event = await catalogRepo.findById(payment.eventId);
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
    await cacheDel(`event:${event._id}`);
    await cacheDelPattern('events:list:*');
  }

  await paymentRepo.updateWalletBalance(payment.userId, refundAmount, 'credit', `Refund (85%) for ${payment.bookingReference}`);

  const organizerClawback = Math.round(payment.amount * 0.80);
  if (event && event.organizerId) {
    await paymentRepo.updateWalletBalance(event.organizerId, -organizerClawback, 'debit', `Refund Clawback for ${payment.bookingReference}`);
  }

  bus.publish('system.alert', { 
    userId: payment.userId, 
    title: '💸 Refund Processed', 
    message: `₹${refundAmount} (85%) refunded for ${payment.bookingReference}` 
  });

  return refundAmount;
};

export const getWalletBalance = async (userId) => {
  let wallet = await paymentRepo.findWalletByUser(userId);
  if (!wallet) wallet = await paymentRepo.createWallet(userId);
  return { balance: wallet.balance, transactions: wallet.transactions.slice(-20).reverse() };
};

export const depositFunds = async (userId, amount) => {
  const wallet = await paymentRepo.updateWalletBalance(userId, Number(amount), 'credit', 'Funds deposited');
  bus.publish('system.alert', { userId, title: '💳 Money Added', message: `₹${amount} deposited successfully.` });
  return wallet.balance;
};

export const withdrawFunds = async (userId, amount) => {
  const wallet = await paymentRepo.findWalletByUser(userId);
  if (!wallet || wallet.balance < amount) throw new Error('INSUFFICIENT_BALANCE');
  
  const updatedWallet = await paymentRepo.updateWalletBalance(userId, -Number(amount), 'debit', 'Withdrawal to Bank');
  bus.publish('system.alert', { userId, title: '💸 Money Withdrawn', message: `₹${amount} withdrawn successfully.` });
  return updatedWallet.balance;
};

export default { 
  processTicketPayment, 
  processRefund, 
  getWalletBalance, 
  depositFunds, 
  withdrawFunds 
};
