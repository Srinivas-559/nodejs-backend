const Classified = require('../models/Classified');

module.exports = (socket) => {
  console.log('Classified socket connected:', socket.id);

  // Join user's personal room when they connect
  socket.on('join-user-room', (email) => {
    socket.join(email);
    console.log(`User ${email} joined their classified room`);
  });

  // Handle classified creation notification
  socket.on('classified-created', async (classified) => {
    try {
      console.log(`New classified created: ${classified._id || 'unknown'}`);
      
      // Notify each viewer that they can see a new classified
      classified.viewableBy.forEach(email => {
        socket.to(email).emit('new-classified', {
          classifiedId: classified._id,
          title: classified.title,
          category: classified.category,
          postedBy: classified.postedBy
        });
      });
    } catch (error) {
      console.error('Error handling classified creation notification:', error);
    }
  });

  // Handle classified deletion notification
  socket.on('classified-deleted', async ({ classifiedId, title, viewableBy }) => {
    try {
      console.log(`Classified deleted: ${classifiedId}, notifying viewers`);
      
      // Notify each viewer about the classified deletion
      if (Array.isArray(viewableBy)) {
        viewableBy.forEach(email => {
          socket.to(email).emit('classified-deleted', { 
            classifiedId,
            title,
            message: 'A classified you had access to has been deleted'
          });
        });
      }
    } catch (error) {
      console.error('Error handling classified deletion notification:', error);
    }
  });

  // Handle socket disconnection
  socket.on('disconnect', () => {
    console.log('Classified socket disconnected:', socket.id);
  });
}; 