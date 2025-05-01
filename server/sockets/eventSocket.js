const Event = require('../models/Event');
const EventUser = require('../models/EventUser');

module.exports = (socket) => {
  console.log('Event socket connected:', socket.id);

  // Join user's personal room when they connect
  socket.on('join-user-room', (email) => {
    socket.join(email);
    console.log(`User ${email} joined their room`);
  });

  // Invite to Event
  socket.on('invite-to-event', async ({ organizerEmail, inviteeEmail, eventId }) => {
    try {
      const event = await Event.findById(eventId);
      if (!event) return socket.emit('invite-error', { message: 'Event not found' });
      if (event.organizerEmail !== organizerEmail) {
        return socket.emit('invite-error', { message: 'Only organizer can invite users' });
      }

      const alreadyJoined = await EventUser.findOne({ eventId, email: inviteeEmail });
      if (alreadyJoined) {
        return socket.emit('invite-error', { message: 'User already joined the event' });
      }

      // Create pending participation
      await EventUser.create({
        eventId,
        email: inviteeEmail,
        status: 'pending'
      });

      // Send invitation directly to the user's room
      socket.to(inviteeEmail).emit('event-invitation', {
        eventId,
        eventName: event.name,
        inviteeEmail,
        organizerEmail,
        eventDate: event.date,
        eventLocation: event.location
      });

    } catch (error) {
      console.error('Invite error:', error);
      socket.emit('invite-error', { message: 'Internal server error' });
    }
  });

  // Handle accepting the invitation
  socket.on('accept-invitation', async ({ eventId, inviteeEmail, username }) => {
    try {
      const event = await Event.findById(eventId);
      if (!event) return socket.emit('invite-error', { message: 'Event not found' });

      // Update participation status
      const updated = await EventUser.findOneAndUpdate(
        { eventId, email: inviteeEmail },
        { status: 'joined', joinedAt: new Date(), username },
        { new: true }
      );

      if (!updated) {
        return socket.emit('invite-error', { message: 'Invitation not found' });
      }

      // Notify the participant they've joined
      socket.to(inviteeEmail).emit('event-joined', {
        _id: event._id,
        name: event.name,
        date: event.date,
        location: event.location,
        description: event.description,
        organizerEmail: event.organizerEmail
      });

      // Notify organizer about the acceptance
      socket.to(event.organizerEmail).emit('participant-updated', {
        eventId,
        email: inviteeEmail,
        status: 'joined'
      });

    } catch (error) {
      console.error('Accept invitation error:', error);
      socket.emit('invite-error', { message: 'Internal server error' });
    }
  });

  // Handle direct event joining (without invitation)
  socket.on('event-joined', (eventData) => {
    // This is handled on the frontend - no backend action needed
    console.log(`User joined event ${eventData._id}`);
  });

  // Handle event deletion notification
  socket.on('event-deleted', async ({ eventId }) => {
    try {
      // Find all participants of this event to notify them
      const participants = await EventUser.find({ eventId });
      
      // Log deletion
      console.log(`Event ${eventId} deleted, notifying ${participants.length} participants`);
      
      // Notify each participant about the event deletion
      participants.forEach(participant => {
        socket.to(participant.email).emit('event-deleted', { 
          eventId,
          message: 'An event you were participating in has been deleted'
        });
      });
    } catch (error) {
      console.error('Error handling event deletion notification:', error);
    }
  });

  // Handle socket disconnection
  socket.on('disconnect', () => {
    console.log('Event socket disconnected:', socket.id);
  });
};