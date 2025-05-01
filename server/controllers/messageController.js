const Message = require('../models/Message');
const User = require('../models/User');

exports.getMessages = async (req, res) => {
  try {
    const { from, to, page = 1, limit = 50 } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Missing from or to parameters' });
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const query = {
      $or: [
        { from, to },
        { from: to, to: from }
      ]
    };

    const totalCount = await Message.countDocuments(query);

    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limitNumber);

    // Mark messages as read (only if they are unread and sent *to* the current user)
    await Message.updateMany(
      { from: to, to: from, read: false },
      { $set: { read: true } }
    );

    res.json({
      totalCount,
      page: pageNumber,
      limit: limitNumber,
      messages: messages.reverse() // oldest first for UI
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getLatestChats = async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: 'Missing name parameter' });
    }

    const messages = await Message.aggregate([
      {
        $match: {
          $or: [{ from: name }, { to: name }]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $lt: ["$from", "$to"] },
              { from: "$from", to: "$to" },
              { from: "$to", to: "$from" }
            ]
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ["$to", name] },
                  { $eq: ["$read", false] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$lastMessage",
              { unreadCount: "$unreadCount" }
            ]
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.json(messages);
  } catch (err) {
    console.error('Latest chats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.clearChat = async (req, res) => {
  try {
    const { user1, user2 } = req.body;
    
    console.log(`[CHAT] CLEAR - Request to clear chat between ${user1} and ${user2}`);

    if (!user1 || !user2) {
      console.log('[CHAT] CLEAR - Missing user parameters');
      return res.status(400).json({ error: 'Both user parameters are required' });
    }

    // Create query to find all messages between these two users
    const query = {
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 }
      ]
    };

    // Count messages before deletion for logging/response
    const messageCount = await Message.countDocuments(query);
    console.log(`[CHAT] CLEAR - Found ${messageCount} messages to delete`);

    // Delete all messages
    const result = await Message.deleteMany(query);
    
    console.log(`[CHAT] CLEAR - Deleted ${result.deletedCount} messages between ${user1} and ${user2}`);

    // Emit socket event to notify both users
    const io = req.app.get('io');
    if (io) {
      // Emit to both users' rooms
      io.to(user1).emit('chat-cleared', { 
        withUser: user2,
        clearedBy: user1,
        timestamp: new Date()
      });
      
      io.to(user2).emit('chat-cleared', { 
        withUser: user1,
        clearedBy: user1,
        timestamp: new Date()
      });
      
      console.log(`[CHAT] CLEAR - Socket notification sent to ${user1} and ${user2}`);
    }

    res.json({ 
      success: true, 
      message: 'Chat history cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('[CHAT] CLEAR - Error:', err);
    res.status(500).json({ error: 'Server error', message: err.message });
  }
};

