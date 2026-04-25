import * as paymentService from '../service/payment.service.js';
import response from '../../../shared/utils/response.js';

export const payTicket = async (req, res, next) => {
  try {
    const payment = await paymentService.processTicketPayment(req.user.id, req.body, req.user);
    response.success(res, payment, 'Payment processed successfully');
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') return response.error(res, 'Insufficient wallet balance', 402);
    next(err);
  }
};

export const getWallet = async (req, res, next) => {
  try {
    const wallet = await paymentService.getWalletBalance(req.user.id);
    response.success(res, wallet);
  } catch (err) { next(err); }
};

export const deposit = async (req, res, next) => {
  try {
    const balance = await paymentService.depositFunds(req.user.id, req.body.amount);
    response.success(res, { balance }, 'Deposit successful');
  } catch (err) { next(err); }
};

export const withdraw = async (req, res, next) => {
  try {
    const balance = await paymentService.withdrawFunds(req.user.id, req.body.amount);
    response.success(res, { balance }, 'Withdrawal successful');
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') return response.error(res, 'Insufficient balance', 400);
    next(err);
  }
};

export const refund = async (req, res, next) => {
  try {
    const amount = await paymentService.processRefund(req.params.id);
    response.success(res, { refundedAmount: amount }, 'Refund processed successfully');
  } catch (err) {
    if (err.message === 'INVALID_PAYMENT') return response.error(res, 'Payment not found or not eligible for refund', 404);
    next(err);
  }
};

export default {
  payTicket,
  getWallet,
  deposit,
  withdraw,
  refund
};
