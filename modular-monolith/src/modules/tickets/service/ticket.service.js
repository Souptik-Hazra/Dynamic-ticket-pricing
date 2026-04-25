import bus from '../../../shared/utils/bus.js';
import { cacheDel, cacheDelPattern } from '../../../shared/utils/cache.js';
import { createBookingReference, createTicketQrToken, verifyTemporalProof } from '../../../shared/utils/helpers.js';
import { generateBrandedQR } from '../../../shared/utils/media.js';
import ticketRepo from '../repository/ticket.repo.js';

// Cross-module service calls
import aiService from '../../ai/service/ai.service.js';
import catalogRepo from '../../catalog/repository/catalog.repo.js';

const PRICE_ABS_TOLERANCE = 1.0; 
const PRICE_REL_TOLERANCE = 0.02;

export const getTicketsByUser = async (userId) => {
  return await ticketRepo.findByUser(userId);
};

export const getTicketDetail = async (ticketId, user) => {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket) throw new Error('TICKET_NOT_FOUND');
  if (String(ticket.userId) !== user.id && user.role !== 'admin') throw new Error('UNAUTHORIZED');
  return ticket;
};

export async function purchaseTickets(userId, data, userDetails) {
  const { 
    eventId, categoryId, categoryName, quantity, selectedSeats = [], 
    customerName, customerEmail, pricePerTicket,
    humanityProof, temporalProof, cognitive_score, behavioralMetadata
  } = data;

  if (!humanityProof || !temporalProof || !verifyTemporalProof(humanityProof, temporalProof)) {
    throw new Error('INVALID_TEMPORAL_PROOF');
  }

  const isHuman = await aiService.auditHumanity(userId, humanityProof, behavioralMetadata || {});
  if (!isHuman) throw new Error('BEHAVIORAL_ANOMALY');

  const event = await catalogRepo.findById(eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const cat = (event.ticketCategories || []).find(c => (categoryId && String(c._id) === String(categoryId)) || c.name === categoryName) || null;
  const ticketCount = Math.max(1, Number(quantity) || (Array.isArray(selectedSeats) ? selectedSeats.length : 1));

  const score = typeof cognitive_score === 'number' ? cognitive_score : 1.0;
  const serverPrice = await aiService.getCalculatedPrice(cat, event, score, userId);
  
  // UX Step: Honor the Locked Price if it exists
  const { getVerifiedPrice } = await import('../../../shared/utils/priceLock.js');
  const finalPricePerTicket = await getVerifiedPrice(userId, eventId, cat?._id, serverPrice);
  
  const clientPrice = Number(pricePerTicket) || 0;

  const absDiff = Math.abs(clientPrice - finalPricePerTicket);
  const relDiff = finalPricePerTicket > 0 ? absDiff / finalPricePerTicket : 0;

  if (absDiff > PRICE_ABS_TOLERANCE && relDiff > PRICE_REL_TOLERANCE) {
    const err = new Error('PRICE_MISMATCH');
    err.serverPrice = finalPricePerTicket;
    throw err;
  }

  // Log price decision for A/B Testing
  const { logExperimentResult, getExperimentSegment } = await import('../../analytics/abTest.service.js');
  const segment = getExperimentSegment(userId);
  await logExperimentResult(userId, 'pricing_tourney_v1', segment === 'A' ? 'stable_v1' : 'experimental_fomo_v2', finalPricePerTicket * ticketCount, (finalPricePerTicket - (cat?.price || event.basePrice)) * ticketCount);

  await aiService.logAuditDecision({
    eventId, categoryId, price: finalPricePerTicket, qty: ticketCount, hash: temporalProof, humanitySignature: humanityProof
  }, userId).catch(() => null);

  const updatedEvent = await allocateInventory(event._id, cat?._id, ticketCount, selectedSeats);
  if (!updatedEvent) throw new Error('INVENTORY_UNAVAILABLE_OR_SEATS_TAKEN');

  const ticketsToCreate = [];
  const finalName = customerName || userDetails.name || 'Guest';
  const finalEmail = customerEmail || userDetails.email;
  const bookingRef = createBookingReference();

  for (let i = 0; i < ticketCount; i++) {
    const qrToken = createTicketQrToken();
    const qrData = JSON.stringify({ token: qrToken, bookingRef });
    const qrCodeImage = await generateBrandedQR(qrData, null); 

    ticketsToCreate.push({
      eventId, userId, categoryId: cat?._id, categoryName: cat?.name || categoryName || 'standard',
      seatNumber: selectedSeats[i], customerName: finalName, customerEmail: finalEmail, quantity: 1,
      pricePerTicket: serverPrice, totalAmount: serverPrice, status: 'confirmed', 
      qrToken, qrCode: qrCodeImage,
      bookingReference: bookingRef
    });
  }

  const tickets = await ticketRepo.create(ticketsToCreate);

  bus.publish('ticket.sold', { eventId, categoryName: cat?.name || 'standard', remainingSeats: updatedEvent.availableTickets, count: tickets.length });
  bus.publish('ticket.purchased', { userId, count: tickets.length, eventName: event.name });

  return tickets;
}

export async function verifyAndUseTicket(token, user) {
  const ticket = await ticketRepo.findByQrToken(token);
  if (!ticket || ticket.isUsed || ticket.status !== 'confirmed') throw new Error('TICKET_INVALID_OR_USED');

  const event = await catalogRepo.findById(ticket.eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const isAuthorized = ['admin', 'staff', 'organizer'].includes(user.role) || 
                       (event.organizerId && String(event.organizerId) === user.id);

  if (!isAuthorized) throw new Error('UNAUTHORIZED_VERIFIER');

  ticket.isUsed = true;
  await ticket.save();

  const [scannedCount, totalSold] = await Promise.all([
    ticketRepo.aggregate([
      { $match: { eventId: ticket.eventId, isUsed: true, status: 'confirmed' } },
      { $count: 'count' }
    ]),
    ticketRepo.aggregate([
      { $match: { eventId: ticket.eventId, status: 'confirmed' } },
      { $count: 'count' }
    ])
  ]);

  const sCount = scannedCount[0]?.count || 0;
  const tSold = totalSold[0]?.count || 0;

  bus.publish('attendance.updated', { eventId: ticket.eventId, scannedCount: sCount, totalSold: tSold });
  
  return { ticket, stats: { scannedCount: sCount, totalSold: tSold } };
}

export async function cancelTicket(ticketId, reason = 'user_cancelled') {
  const ticket = await ticketRepo.findById(ticketId);
  if (!ticket || ticket.status === 'cancelled') return null;

  // Restore inventory atomically
  const filter = { _id: ticket.eventId };
  const update = { $inc: { availableTickets: ticket.quantity, ticketsSold: -ticket.quantity } };
  
  if (ticket.categoryId) {
    filter['ticketCategories._id'] = ticket.categoryId;
    update.$inc['ticketCategories.$.availableSeats'] = ticket.quantity;
    if (ticket.seatNumber) {
      update.$pull = { 'ticketCategories.$.bookedSeats': ticket.seatNumber };
    }
  }
  
  await catalogRepo.updateInventory(filter, update);

  ticket.status = 'cancelled';
  ticket.metadata = { ...ticket.metadata, cancellationReason: reason };
  return await ticket.save();
}

export const allocateInventory = async (eventId, categoryId, ticketCount, selectedSeats = [], expectedVersion = null) => {
  let filter = { _id: eventId, status: { $ne: 'cancelled' } };
  
  // Diamond Step: Optimistic Locking
  if (expectedVersion !== null) {
    filter.__v = expectedVersion;
  }

  let update = { $inc: { availableTickets: -ticketCount, ticketsSold: ticketCount, __v: 1 } };

  if (categoryId) {
    filter['ticketCategories._id'] = categoryId;
    filter['ticketCategories.availableSeats'] = { $gte: ticketCount };
    
    // RACE CONDITION FIX: Ensure seats are not already booked
    if (selectedSeats && selectedSeats.length > 0) {
      filter['ticketCategories.bookedSeats'] = { $nin: selectedSeats };
    }
    
    update.$inc['ticketCategories.$.availableSeats'] = -ticketCount;
    if (selectedSeats && selectedSeats.length > 0) {
      update.$addToSet = { 'ticketCategories.$.bookedSeats': { $each: selectedSeats } };
    }
  } else {
    filter.availableTickets = { $gte: ticketCount };
  }

  const updatedEvent = await catalogRepo.updateInventory(filter, update);
  if (updatedEvent) {
    await cacheDel(`event:${eventId}`);
    await cacheDelPattern('events:list:*');
  }
  return updatedEvent;
}

export const findWithEvent = async (filter) => {
  return await ticketRepo.findWithEvent(filter);
};

export const findMany = async (filter, select = {}) => {
  return await ticketRepo.findMany(filter, select);
};

export const updateStatus = async (filter, status, options = {}) => {
  return await ticketRepo.updateMany(filter, { $set: { status } }, options);
};

export default { 
  getTicketsByUser,
  getTicketDetail,
  purchaseTickets, 
  verifyAndUseTicket, 
  cancelTicket,
  allocateInventory,
  findWithEvent,
  findMany,
  updateStatus
};
