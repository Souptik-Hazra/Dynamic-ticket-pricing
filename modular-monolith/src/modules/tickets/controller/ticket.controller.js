import * as ticketService from '../service/ticket.service.js';
import response from '../../../shared/utils/response.js';

export const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await ticketService.getTicketsByUser(req.user.id);
    response.success(res, tickets);
  } catch (err) { next(err); }
};

export const getDetail = async (req, res, next) => {
  try {
    const ticket = await ticketService.getTicketDetail(req.params.id, req.user);
    response.success(res, ticket);
  } catch (err) {
    if (err.message === 'TICKET_NOT_FOUND') return response.error(res, 'Ticket not found', 404);
    if (err.message === 'UNAUTHORIZED') return response.error(res, 'Forbidden', 403);
    next(err);
  }
};

export const purchase = async (req, res, next) => {
  try {
    const tickets = await ticketService.purchaseTickets(req.user.id, req.body, req.user);
    response.success(res, tickets, 'Reservation successful', 201);
  } catch (err) {
    if (err.message === 'PRICE_MISMATCH') return response.error(res, 'Price mismatch', 409, { serverPrice: err.serverPrice });
    if (err.message === 'INVENTORY_UNAVAILABLE' || err.message === 'INVENTORY_UNAVAILABLE_OR_SEATS_TAKEN') {
      return response.error(res, 'Tickets no longer available', 410);
    }
    next(err);
  }
};

export const verify = async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await ticketService.verifyAndUseTicket(token, req.user);
    response.success(res, result, 'Ticket verified and checked-in');
  } catch (err) {
    if (err.message === 'TICKET_INVALID_OR_USED') return response.error(res, 'Ticket invalid or already used', 400);
    if (err.message === 'UNAUTHORIZED_VERIFIER') return response.error(res, 'Not authorized to verify tickets', 403);
    next(err);
  }
};

export default {
  getMyTickets,
  getDetail,
  purchase,
  verify
};
