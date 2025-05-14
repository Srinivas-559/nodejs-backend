const mongoose = require('mongoose');
const groupMessageSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String },
  messageType: { type: String, enum: ['text', 'image', 'file', 'system'], default: 'text' },
  attachments: [{
    fileName: String,
    fileType: String,
    fileUrl: String
  }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('GroupMessage', groupMessageSchema);
