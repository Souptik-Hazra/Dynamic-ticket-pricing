const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// @route   GET /api/events
// @desc    Get all events
// @access  Public
router.get('/', async (req, res) => {
  try {
      const events = await Event.find().sort({ date: 1 });
    
    res.json({
      success: true,
      message: 'Events retrieved successfully',
      data: events
    });
  } 
  catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id/dynamic-prices
// @desc    Get dynamic prices for ticket
// @access  Public
router.get('/:id/dynamic-prices', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Return the standard ticket price
    res.json({
      success: true,
      message: 'Dynamic prices retrieved successfully',
      data: {
        eventId: event._id,
        prices: {
          standard: event.ticketPrice
        }
      }
    });
  } catch (error) {
    console.error('Dynamic pricing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id
// @desc    Get event by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({
      success: true,
      message: 'Event retrieved successfully',
      data: event
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/events
// @desc    Create new event
// @access  Public
router.post('/', async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Public
router.put('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Public
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({
      success: true,
      message: 'Event deleted successfully',
      data: null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/events/:id/price
// @desc    Get price for an event
// @access  Public
router.get('/:id/price', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      success: true,
      message: 'Event price retrieved successfully',
      data: {
        event_id: event._id,
        event_name: event.name,
        price: event.ticketPrice
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;
