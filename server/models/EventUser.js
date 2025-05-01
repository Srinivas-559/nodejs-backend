const mongoose = require('mongoose');

const eventUserSchema = new mongoose.Schema({
  eventId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true,
    index: true
  },
  email: { 
    type: String, 
    required: true,
    index: true 
  },
  username: { // NEW FIELD
    type: String,
    required: true
  },
  joinedAt: { 
    type: Date, 
    default: null // Initially null, user joins when they accept
  },
  status: {
    type: String,
    enum: ['pending', 'joined', 'ignored'],
    default: 'pending'
  }
});

// Index for faster lookup
eventUserSchema.index({ eventId: 1, email: 1 }, { unique: true });

// Check if model exists, otherwise create it
const EventUser = mongoose.models.EventUser || mongoose.model('EventUser', eventUserSchema);

module.exports = EventUser;
