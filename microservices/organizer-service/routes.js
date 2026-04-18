import express from 'express';
import Organizer from './models/Organizer.js';
import Event from './models/Event.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Organizer registration
router.post('/organizers/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const organizer = new Organizer({ name, email, password: hashedPassword });
    await organizer.save();
    res.status(201).json({ message: 'Organizer registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Organizer login
router.post('/organizers/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const organizer = await Organizer.findOne({ email });
    if (!organizer) return res.status(404).json({ error: 'Organizer not found' });
    const isMatch = await bcrypt.compare(password, organizer.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ message: 'Login successful', organizerId: organizer._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create event
router.post('/events', async (req, res) => {
  try {
    const { name, description, date, location, organizerId, ticketsAvailable, price } = req.body;
    const event = new Event({ name, description, date, location, organizerId, ticketsAvailable, price });
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all events for an organizer
router.get('/organizers/:organizerId/events', async (req, res) => {
  try {
    const events = await Event.find({ organizerId: req.params.organizerId });
    res.json(events);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update event
router.put('/events/:eventId', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.eventId, req.body, { new: true });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete event
router.delete('/events/:eventId', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
