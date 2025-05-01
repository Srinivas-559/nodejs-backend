module.exports = (socket) => {
    // Invitation subscription
    socket.on('subscribe-invitations', (email) => {
      socket.join(email);
      console.log(`User ${email} subscribed to invitation updates`);
    });
  };