const User = require('../models/User');

module.exports = (socket) => {
  // Register user
  socket.on('register', async (name) => {
    try {
      const user = await User.findOneAndUpdate(
        { name },
        {
          socketId: socket.id,
          isOnline: true,
          lastSeen: new Date()
        },
        { new: true, upsert: true }
      );
  
      if (user) {
        socket.join(name);
        console.log(`✅ User connected: ${user.name} (${socket.id})`);
  
        socket.server.emit('user-status', {
          name,
          isOnline: true,
          lastSeen: user.lastSeen
        });
      }
    } catch (err) {
      console.error('Register error:', err);
      socket.emit('error', { message: 'Server error' });
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    try {
      const user = await User.findOneAndUpdate(
        { socketId: socket.id },
        {
          socketId: null,
          isOnline: false,
          lastSeen: new Date()
        },
        { new: true }
      );

      if (user) {
        socket.server.emit('user-status', {
          name: user.name,
          isOnline: false,
          lastSeen: new Date()
        });
        console.log(`User ${user.name} disconnected`);
      } else {
        console.log("Unknown user disconnected");
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  });
};