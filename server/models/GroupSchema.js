const mongoose = require('mongoose');
const Schema = mongoose.Schema
const groupSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  avatar: { type: String },
  members: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' }, // Quick preview
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
