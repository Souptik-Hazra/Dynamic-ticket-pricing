import Event from '../../shared/models/Event.js';
import Ticket from '../../shared/models/Ticket.js';
import { cacheDel, cacheDelPattern } from '../../shared/cache.js';

/**
 * Ticket Service
 * 
 * Centralized business logic for inventory allocation and seat management.
 */

/**
 * allocateInventory
 * 
 * Atomically deducts tickets from an event and reserves seats if necessary.
 */
export async function allocateInventory(eventId, categoryId, ticketCount, selectedSeats = []) {
  let filter = { _id: eventId, status: { $ne: 'cancelled' } };
  let update = { $inc: { availableTickets: -ticketCount, ticketsSold: ticketCount } };

  if (categoryId) {
    filter['ticketCategories._id'] = categoryId;
    filter['ticketCategories.availableSeats'] = { $gte: ticketCount };
    update.$inc['ticketCategories.$.availableSeats'] = -ticketCount;
    if (selectedSeats.length > 0) {
      update.$addToSet = { 'ticketCategories.$.bookedSeats': { $each: selectedSeats } };
    }
  } else {
    filter.availableTickets = { $gte: ticketCount };
  }

  const updatedEvent = await Event.findOneAndUpdate(filter, update, { new: true });
  
  if (updatedEvent) {
    await cacheDel(`event:${eventId}`);
    await cacheDelPattern('events:list:*');
  }

  return updatedEvent;
}

/**
 * revertInventory
 * 
 * Returns tickets to the pool and releases seats. (Used for Refunds/Cancellations)
 */
export async function revertInventory(eventId, categoryName, quantity, amount, seatNumbers = []) {
  const event = await Event.findById(eventId);
  if (!event) return { success: false, error: 'Event not found' };

  // 1. Return tickets to category pool
  const cat = event.ticketCategories.find(c => c.name === categoryName);
  if (cat) {
    cat.availableSeats = Math.min(cat.seats, (cat.availableSeats || 0) + quantity);
    if (seatNumbers.length > 0) {
      cat.bookedSeats = (cat.bookedSeats || []).filter(s => !seatNumbers.includes(s));
    }
  } else {
    event.availableTickets = Math.min(event.capacity, (event.availableTickets || 0) + quantity);
  }

  // 2. Adjust core revenue metrics
  event.ticketsSold = Math.max(0, (event.ticketsSold || 0) - quantity);
  event.totalRevenue = Math.max(0, (event.totalRevenue || 0) - amount);
  // Re-calculate commission (20%)
  event.commissionCollected = Math.max(0, (event.commissionCollected || 0) - Math.round(amount * 0.20));

  await event.save();
  await cacheDel(`event:${eventId}`);
  await cacheDelPattern('events:list:*');

  return { success: true };
}
