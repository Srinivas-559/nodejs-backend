const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from: {
    type: String,
    required: true,
    ref: 'User'
  },
  to: {
    type: String,
    required: true,
    ref: 'User'
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
messageSchema.index({ from: 1, to: 1 });
messageSchema.index({ to: 1, from: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);