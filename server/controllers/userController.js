const User = require('../models/User');
const Message = require('../models/Message');
const Classified = require('../models/Classified');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ name: { $ne: req.params.name } })
      .sort({ isOnline: -1, name: 1 });
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get user activity - classifieds and organized events only
exports.getUserActivity = async (req, res) => {
  try {
    const { email } = req.params;
    console.log(`[USER ACTIVITY] Request for email: ${email}`);
    
    if (!email) {
      console.log('[USER ACTIVITY] Missing email parameter');
      return res.status(400).json({ error: 'Email parameter is required' });
    }

    // Find user's classifieds
    const classifieds = await Classified.find({ 'postedBy.email': email })
      .sort({ createdAt: -1 });
      
    console.log(`[USER ACTIVITY] Found ${classifieds.length} classifieds for ${email}`);
    
    // Get events organized by the user
    const Event = require('../models/Event');
    const organizedEvents = await Event.find({ organizerEmail: email })
      .sort({ date: -1 });
    
    console.log(`[USER ACTIVITY] Found ${organizedEvents.length} events organized by ${email}`);

    // Get statistics
    const stats = {
      classifiedsCount: classifieds.length,
      activeClassifieds: classifieds.filter(c => new Date(c.expiryDate) >= new Date()).length,
      expiredClassifieds: classifieds.filter(c => new Date(c.expiryDate) < new Date()).length,
      eventsOrganized: organizedEvents.length,
      upcomingEvents: organizedEvents.filter(e => new Date(e.date) >= new Date()).length
    };

    res.json({
      email,
      classifieds,
      events: {
        organized: organizedEvents
      },
      stats
    });
  } catch (err) {
    console.error('[USER ACTIVITY] Error:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
};