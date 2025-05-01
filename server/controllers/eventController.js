const Event = require('../models/Event');
const EventUser = require('../models/EventUser');

// Create Event with Participants
exports.createEvent = async (req, res) => {
    try {
        console.log('CREATE EVENT REQUEST BODY:', JSON.stringify(req.body, null, 2));
        
        const { 
            name, 
            date, 
            location, 
            description, 
            organizerEmail, 
            eventImage, // This should be a string
            participants = [], 
            photos = [], 
            messagingUrl = '', 
            rsvpDeadline 
        } = req.body;
        
        console.log('ORGANIZER EMAIL:', organizerEmail);
        console.log('PARTICIPANTS ARRAY:', JSON.stringify(participants, null, 2));
        console.log('EVENT IMAGE TYPE:', typeof eventImage);
        
        // Validate required fields
        if (!name || !date || !organizerEmail) {
            return res.status(400).json({ 
                message: 'Name, date, and organizer email are required' 
            });
        }

        // Create the event
        const event = new Event({ 
            name, 
            date: new Date(date),
            location, 
            description, 
            organizerEmail,
            eventImage: eventImage && typeof eventImage === 'string' ? eventImage : null, // Ensure it's a string
            photos, // base64 encoded images array
            messagingUrl, // messaging URL
            rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : undefined, // optional, fallback to schema default
        });

        console.log('EVENT OBJECT READY FOR SAVE');
        await event.save();
        console.log('EVENT CREATED:', event._id.toString());

        const io = req.app.get('io');
        
        // Check if organizer email is already in participants
        const organizerInParticipants = participants.some(p => 
            p.email === organizerEmail || p === organizerEmail
        );
        console.log('ORGANIZER ALREADY IN PARTICIPANTS:', organizerInParticipants);
        
        // Normalize participants to ensure they all have correct format
        const normalizedParticipants = participants.map(p => {
            // Handle if participant is just an email string
            if (typeof p === 'string') {
                return { email: p, username: p.split('@')[0] };
            }
            // Handle if participant is an object but missing username
            if (p && typeof p === 'object' && p.email && !p.username) {
                return { ...p, username: p.email.split('@')[0] };
            }
            return p;
        });
        
        console.log('NORMALIZED PARTICIPANTS:', JSON.stringify(normalizedParticipants, null, 2));
        
        const allParticipants = organizerInParticipants 
            ? normalizedParticipants 
            : [
                ...normalizedParticipants, 
                { 
                    email: organizerEmail, 
                    username: req.user?.username || organizerEmail.split('@')[0] || 'Organizer' 
                }
        ];
        
        console.log('ALL PARTICIPANTS TO ADD:', JSON.stringify(allParticipants, null, 2));

        // Add all participants (including organizer) directly as joined
        const participantPromises = allParticipants.map(participant => {
            console.log('ADDING PARTICIPANT:', JSON.stringify(participant));
            return EventUser.create({
                eventId: event._id,
                email: participant.email,
                username: participant.username,
                status: 'joined',
                joinedAt: new Date()
            }).then(eventUser => {
                console.log('PARTICIPANT ADDED SUCCESSFULLY:', participant.email);
                // Notify each participant that they've been added to the event
                io.to(participant.email).emit('event-joined', {
                    eventId: event._id,
                    eventName: event.name,
                    eventDate: event.date,
                    eventLocation: event.location
                });
                return eventUser;
            }).catch(error => {
                console.error('ERROR ADDING PARTICIPANT:', participant.email, error.message);
                // Just log the error but don't throw, so other participants can still be added
                return null;
            });
        });

        const addedParticipants = await Promise.all(participantPromises);
        console.log('ADDED PARTICIPANTS COUNT:', addedParticipants.filter(Boolean).length);

        // Notify all clients about the new event
        io.emit('event-created', event);

        res.status(201).json({ 
            message: 'Event created with all participants joined', 
            event,
            participantCount: addedParticipants.filter(Boolean).length
        });
    } catch (error) {
        console.error('Error creating event:', error);
        
        if (error.code === 11000) {
            console.error('DUPLICATE KEY ERROR DETAILS:', error.keyValue);
            return res.status(400).json({
                message: 'One or more participants are already in this event',
                details: error.keyValue
            });
        }
        
        res.status(500).json({ 
            message: 'Error creating event', 
            error: error.message 
        });
    }
};

// Join Event
// exports.joinEvent = async (req, res) => {
//   try {
//     const { eventId, email } = req.body;

//     const existing = await EventUser.findOne({ eventId, email });
//     if (existing) {
//       return res.status(400).json({ message: 'Already joined this event' });
//     }

//     const participation = new EventUser({ eventId, email });
//     await participation.save();
//     res.status(201).json({ message: 'Joined event successfully', participation });
//   } catch (error) {
//     res.status(500).json({ message: 'Error joining event', error });
//   }
// };

// Get Participated Events
exports.getParticipatedEvents = async (req, res) => {
  try {
    const { email } = req.params;
    console.log('FETCHING PARTICIPATED EVENTS FOR EMAIL:', email);
    
    const participations = await EventUser.find({ email }).populate('eventId');
    console.log('FOUND PARTICIPATIONS COUNT:', participations.length);
    console.log('PARTICIPATION EVENT IDs:', participations.map(p => p.eventId?._id ? p.eventId._id.toString() : 'null').join(', '));
    
    res.json(participations);
  } catch (error) {
    console.error('ERROR FETCHING PARTICIPATED EVENTS:', error);
    res.status(500).json({ message: 'Error fetching participated events', error });
  }
};

// Enhanced Get Organized Events with filtering
exports.getOrganizedEvents = async (req, res) => {
    try {
        const { email } = req.params;
        const { status, page = 1, limit = 10 } = req.query;
        
        console.log('FETCHING ORGANIZED EVENTS FOR EMAIL:', email);
        console.log('QUERY PARAMS:', { status, page, limit });

        // Build query
        const query = { organizerEmail: email };
        
        // Add status filter if provided
        if (status === 'active') {
            query.date = { $gte: new Date() };
        } else if (status === 'past') {
            query.date = { $lt: new Date() };
        }
        
        console.log('QUERY FILTER:', JSON.stringify(query));

        // Execute query with pagination
        const events = await Event.find(query)
            .sort({ date: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();
            
        console.log('FOUND ORGANIZED EVENTS COUNT:', events.length);
        console.log('ORGANIZED EVENT IDs:', events.map(e => e._id.toString()).join(', '));

        // Get total count for pagination info
        const count = await Event.countDocuments(query);
        
        console.log('TOTAL EVENTS COUNT:', count);

        res.status(200).json({
            events,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalEvents: count
        });
    } catch (error) {
        console.error('ERROR FETCHING ORGANIZED EVENTS:', error);
        res.status(500).json({ 
            message: 'Error fetching organized events', 
            error: error.message 
        });
    }
};

// Delete Event and all related participants
exports.deleteEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        console.log('DELETING EVENT WITH ID:', eventId);
        
        if (!eventId) {
            return res.status(400).json({ message: 'Event ID is required' });
        }
        
        // Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            console.log('EVENT NOT FOUND:', eventId);
            return res.status(404).json({ message: 'Event not found' });
        }
        
        console.log('FOUND EVENT TO DELETE:', event.name);
        
        // Delete all associated EventUser records
        const deletedParticipants = await EventUser.deleteMany({ eventId });
        console.log('DELETED PARTICIPANTS COUNT:', deletedParticipants.deletedCount);
        
        // Delete the event itself
        await Event.findByIdAndDelete(eventId);
        console.log('EVENT DELETED SUCCESSFULLY');
        
        // Notify connected clients about the event deletion
        const io = req.app.get('io');
        io.emit('event-deleted', { eventId });
        
        return res.status(200).json({ 
            message: 'Event and all participants deleted successfully',
            deletedParticipantsCount: deletedParticipants.deletedCount
        });
    } catch (error) {
        console.error('ERROR DELETING EVENT:', error);
        return res.status(500).json({ 
            message: 'Error deleting event', 
            error: error.message 
        });
    }
};