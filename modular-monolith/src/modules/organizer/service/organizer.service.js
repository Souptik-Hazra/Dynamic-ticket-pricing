import bus from '../../../shared/utils/bus.js';
import { cacheDel, cacheDelPattern } from '../../../shared/utils/cache.js';

// Cross-module service calls
import catalogRepo from '../../catalog/repository/catalog.repo.js';
import ticketRepo from '../../tickets/repository/ticket.repo.js';
import userRepo from '../../users/repository/user.repo.js';

export const getOrganizerDashboardStats = async (organizerId) => {
  // We can use repos directly for aggregation if it's complex, or add a service method
  const [eventsCount, ticketsAgg] = await Promise.all([
    catalogRepo.countEvents({ organizerId }),
    ticketRepo.aggregate([
      { $match: { status: 'confirmed' } },
      { 
        $lookup: {
          from: 'events',
          localField: 'eventId',
          foreignField: '_id',
          as: 'event'
        }
      },
      { $unwind: '$event' },
      { $match: { 'event.organizerId': organizerId } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' }, totalTickets: { $sum: '$quantity' } } }
    ])
  ]);

  const { totalRevenue = 0, totalTickets = 0 } = ticketsAgg[0] || {};
  return {
    totalEvents: eventsCount,
    totalTickets,
    totalRevenue
  };
};

export const getEventsByOrganizer = async (organizerId) => {
  return await catalogRepo.findMany({ organizerId });
};

export const getTicketsByOrganizer = async (organizerId) => {
  const events = await catalogRepo.findMany({ organizerId }, { _id: 1 });
  const eventIds = events.map(e => e._id);
  // Ideally repo should handle population or we do it here
  return await ticketRepo.findWithEvent({ eventId: { $in: eventIds } });
};

export const createEvent = async (organizerId, eventData) => {
  // Use catalogRepo directly or catalogService
  const event = await catalogRepo.create({ ...eventData, organizerId });
  await cacheDelPattern('events:list:*');
  bus.publish('event.created', { eventId: event._id, name: event.name });
  return event;
};

export const updateEvent = async (eventId, organizerId, updateData) => {
  const event = await catalogRepo.findOneAndUpdate(
    { _id: eventId, organizerId },
    updateData
  );
  if (!event) throw new Error('EVENT_NOT_FOUND_OR_UNAUTHORIZED');

  await cacheDel(`event:${eventId}`);
  await cacheDelPattern('events:list:*');
  return event;
};

export const deleteEventCascade = async (eventId, organizerId) => {
  const event = await catalogRepo.findOneAndDelete({ _id: eventId, organizerId });
  if (!event) throw new Error('EVENT_NOT_FOUND_OR_UNAUTHORIZED');

  await ticketRepo.updateMany({ eventId }, { $set: { status: 'cancelled' } });
  
  await cacheDel(`event:${eventId}`);
  await cacheDelPattern('events:list:*');
  
  bus.publish('system.alert', { 
    title: 'Event Cancelled', 
    message: `The event "${event.name}" has been deleted. All tickets are now invalid.` 
  });

  return true;
};

export const broadcastToAttendees = async (eventId, organizerId, title, message) => {
  const event = await catalogRepo.findByIdAndOrganizer(eventId, organizerId);
  if (!event) throw new Error('UNAUTHORIZED');

  const tickets = await ticketRepo.findMany({ eventId, status: 'confirmed' }, { userId: 1 });
  const userIds = [...new Set(tickets.map(t => String(t.userId)))];
  
  for (const uid of userIds) {
    bus.publish('system.alert', { 
      userId: uid, 
      title: `Event Update: ${title}`, 
      message 
    });
  }
  return userIds.length;
};

export const messageAdminsFromOrganizer = async (organizerName, message) => {
  const admins = await userRepo.listUsers({ role: 'admin' });
  for (const admin of admins) {
    bus.publish('system.alert', { 
      userId: admin._id, 
      title: `Message from ${organizerName}`, 
      message 
    });
  }
  return admins.length;
};

export default { 
  getOrganizerDashboardStats, 
  getEventsByOrganizer,
  getTicketsByOrganizer,
  createEvent, 
  updateEvent, 
  deleteEventCascade, 
  broadcastToAttendees,
  messageAdminsFromOrganizer
};
