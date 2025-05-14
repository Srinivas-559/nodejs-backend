const Group = require('../models/GroupSchema');
const GroupMessage = require('../models/GroupMessageSchema');
const User = require('../models/User');

// Create a new group
exports.createGroup = async (req, res) => {
  try {
    const { name, description, avatar, members } = req.body;
    
    const group = new Group({
      name,
      description,
      avatar,
      members: [{ userId: req.user._id, role: 'admin' }, ...members.map(m => ({ userId: m }))],
      admins: [req.user._id],
      createdBy: req.user._id
    });

    await group.save();
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get group details
exports.getGroupDetails = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('members.userId', 'name isOnline lastSeen')
      .populate('admins', 'name')
      .populate('createdBy', 'name');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Update group info (only admins)
exports.updateGroupInfo = async (req, res) => {
  try {
    const { name, description, avatar } = req.body;
    const group = await Group.findOneAndUpdate(
      { _id: req.params.groupId, admins: req.user._id },
      { name, description, avatar },
      { new: true }
    );

    if (!group) {
      return res.status(403).json({ message: 'Not authorized or group not found' });
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Delete group (only creator or admin)
exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findOneAndDelete({
      _id: req.params.groupId,
      $or: [{ createdBy: req.user._id }, { admins: req.user._id }]
    });

    if (!group) {
      return res.status(403).json({ message: 'Not authorized or group not found' });
    }

    // Delete all related messages
    await GroupMessage.deleteMany({ groupId: group._id });

    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Add members to group (admin only)
exports.addMembers = async (req, res) => {
  try {
    const { userIds } = req.body;
    const group = await Group.findOneAndUpdate(
      { _id: req.params.groupId, admins: req.user._id },
      { $addToSet: { members: { $each: userIds.map(id => ({ userId: id })) } } },
      { new: true }
    );

    if (!group) {
      return res.status(403).json({ message: 'Not authorized or group not found' });
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Remove member from group (admin or self)
exports.removeMember = async (req, res) => {
  try {
    const group = await Group.findOneAndUpdate(
      { 
        _id: req.params.groupId,
        $or: [
          { admins: req.user._id },
          { 'members.userId': req.user._id, 'members.userId': req.params.userId }
        ]
      },
      { $pull: { members: { userId: req.params.userId }, admins: req.params.userId } },
      { new: true }
    );

    if (!group) {
      return res.status(403).json({ message: 'Not authorized or group not found' });
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Add admin (creator only)
exports.addAdmin = async (req, res) => {
  try {
    const { userId } = req.body;
    const group = await Group.findOneAndUpdate(
      { _id: req.params.groupId, createdBy: req.user._id },
      { $addToSet: { admins: userId, members: { userId, role: 'admin' } } },
      { new: true }
    );

    if (!group) {
      return res.status(403).json({ message: 'Not authorized or group not found' });
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Remove admin (creator only)
exports.removeAdmin = async (req, res) => {
  try {
    const group = await Group.findOneAndUpdate(
      { _id: req.params.groupId, createdBy: req.user._id },
      { 
        $pull: { admins: req.params.userId },
        $set: { 'members.$[elem].role': 'member' }
      },
      { 
        new: true,
        arrayFilters: [{ 'elem.userId': req.params.userId }]
      }
    );

    if (!group) {
      return res.status(403).json({ message: 'Not authorized or group not found' });
    }

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get group messages
exports.getGroupMessages = async (req, res) => {
  try {
    const messages = await GroupMessage.find({ groupId: req.params.groupId })
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};