import * as organizerService from '../service/organizer.service.js';

export const getStats = async (req, res, next) => {
  try {
    const stats = await organizerService.getOrganizerDashboardStats(req.user.id);
    res.json({ stats });
  } catch (err) { next(err); }
};

export const getMyEvents = async (req, res, next) => {
  try {
    const events = await organizerService.getEventsByOrganizer(req.user.id);
    res.json({ events });
  } catch (err) { next(err); }
};

export const createEvent = async (req, res, next) => {
  try {
    const event = await organizerService.createEvent(req.user.id, req.body);
    res.status(201).json({ event });
  } catch (err) { next(err); }
};

export const updateEvent = async (req, res, next) => {
  try {
    const event = await organizerService.updateEvent(req.params.id, req.user.id, req.body);
    res.json({ event });
  } catch (err) {
    if (err.message === 'EVENT_NOT_FOUND_OR_UNAUTHORIZED') return res.status(404).json({ error: 'Event not found' });
    next(err);
  }
};

export const deleteEvent = async (req, res, next) => {
  try {
    await organizerService.deleteEventCascade(req.params.id, req.user.id);
    res.json({ success: true, message: 'Event deleted and tickets cancelled' });
  } catch (err) {
    if (err.message === 'EVENT_NOT_FOUND_OR_UNAUTHORIZED') return res.status(404).json({ error: 'Event not found' });
    next(err);
  }
};

export const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await organizerService.getTicketsByOrganizer(req.user.id);
    res.json({ tickets });
  } catch (err) { next(err); }
};

export const broadcast = async (req, res, next) => {
  try {
    const { eventId, title, message } = req.body;
    const count = await organizerService.broadcastToAttendees(eventId, req.user.id, title, message);
    res.json({ success: true, count });
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') return res.status(403).json({ error: 'Unauthorized' });
    next(err);
  }
};

export const messageAdmin = async (req, res, next) => {
  try {
    await organizerService.messageAdminsFromOrganizer(req.user.name, req.body.message);
    res.json({ success: true });
  } catch (err) { next(err); }
};

export const health = (req, res) => res.json({ status: 'ok', service: 'organizer-module' });

export default {
  getStats,
  getMyEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getMyTickets,
  broadcast,
  messageAdmin,
  health
};
