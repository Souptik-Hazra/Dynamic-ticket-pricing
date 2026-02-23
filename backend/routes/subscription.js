const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/subscription/upgrade
// @desc    Upgrade user subscription
// @access  Private
router.post('/upgrade', protect, async (req, res) => {
  try {
    const { plan } = req.body; // '7_days', '30_days', '3_months', '6_months', '1_year'
    if (!['7_days', '30_days', '3_months', '6_months', '1_year'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot subscribe to membership plans.' });
    }
    const startDate = new Date();
    let endDate = new Date(startDate);
    switch (plan) {
      case '7_days':
        endDate.setDate(startDate.getDate() + 7);
        break;
      case '30_days':
        endDate.setDate(startDate.getDate() + 30);
        break;
      case '3_months':
        endDate.setMonth(startDate.getMonth() + 3);
        break;
      case '6_months':
        endDate.setMonth(startDate.getMonth() + 6);
        break;
      case '1_year':
        endDate.setFullYear(startDate.getFullYear() + 1);
        break;
    }
    user.subscription = {
      plan: plan,
      startDate: startDate,
      endDate: endDate,
      isActive: true
    };
    await user.save();
    res.json({ 
      success: true, 
      message: `Successfully subscribed to ${plan} plan`,
      subscription: user.subscription 
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Server error processing subscription' });
  }
});

// @route   GET /api/subscription/status
// @desc    Get current subscription status
// @access  Private
router.get('/status', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if(!user) return res.status(404).json({error: "User not found"});

        // Check expiry
        if (user.subscription && user.subscription.isActive && user.subscription.endDate) {
            if (new Date() > new Date(user.subscription.endDate)) {
                user.subscription.isActive = false;
                await user.save();
            }
        }

        res.json({
            subscription: user.subscription
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Server Error"});
    }
});

module.exports = router;
