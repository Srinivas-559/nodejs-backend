const Group = require('../models/GroupSchema');
const GroupMessage = require('../models/GroupMessageSchema');
const User = require('../models/User');

module.exports = (socket) => {
  // Join group rooms on connection
  socket.on('join-groups', async (groupIds) => {
    try {
      groupIds.forEach(groupId => {
        socket.join(groupId);
        console.log(`User joined group room: ${groupId}`);
      });
    } catch (err) {
      console.error('Join groups error:', err);
    }
  });

  // Send group message
  socket.on('group-message', async ({ groupId, content, attachments, messageType }) => {
    try {
      const group = await Group.findById(groupId);
      if (!group || !group.members.some(m => m.userId.equals(socket.user._id))) {
        throw new Error('Not a member of this group');
      }

      const message = new GroupMessage({
        groupId,
        sender: socket.user._id,
        content,
        messageType,
        attachments
      });

      await message.save();

      // Update group's last message reference
      await Group.findByIdAndUpdate(groupId, { lastMessage: message._id });

      // Populate sender info before emitting
      const populatedMsg = await GroupMessage.populate(message, { path: 'sender', select: 'name' });

      // Emit to all group members
      socket.server.to(groupId).emit('group-message', populatedMsg);
    } catch (err) {
      console.error('Group message error:', err);
      socket.emit('group-message-error', { error: err.message });
    }
  });

  // Message read receipt
  socket.on('group-message-read', async ({ groupId, messageId }) => {
    try {
      const message = await GroupMessage.findOneAndUpdate(
        { _id: messageId, groupId },
        { $addToSet: { readBy: socket.user._id } },
        { new: true }
      );

      if (message) {
        socket.server.to(groupId).emit('group-message-read', {
          messageId,
          readBy: message.readBy
        });
      }
    } catch (err) {
      console.error('Message read error:', err);
    }
  });

  // Group updates (members added/removed, info changed)
  socket.on('group-update', async (groupId) => {
    try {
      const group = await Group.findById(groupId)
        .populate('members.userId', 'name isOnline lastSeen')
        .populate('admins', 'name');

      if (group) {
        socket.server.to(groupId).emit('group-updated', group);
      }
    } catch (err) {
      console.error('Group update error:', err);
    }
  });
};