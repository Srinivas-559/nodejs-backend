const Invitation = require('../models/Invitation');
const axios = require('axios');

exports.createInvitation = async (req, res, io) => {
  try {
    const { senderEmail, receiverEmail, eventData } = req.body;
    console.log(req.body)
    const newInvitation = new Invitation({
      senderEmail,
      receiverEmail,
      eventData
    });

    const savedInvitation = await newInvitation.save();
    io.to(senderEmail).emit('sent_invitation' , savedInvitation)
    io.to(receiverEmail).emit('new_invitation', savedInvitation);
    res.status(201).json(savedInvitation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getSentInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({ senderEmail: req.params.email })
      .sort({ createdAt: -1 });
    res.json(invitations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getReceivedInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({ 
      receiverEmail: req.params.email
    }).sort({ createdAt: -1 });
    res.json(invitations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.respondToInvitation = async (req, res, io) => {
  try {
    const { response } = req.body;
    if (!['accepted', 'rejected'].includes(response)) {
      return res.status(400).json({ message: 'Invalid response' });
    }

    const updatedInvitation = await Invitation.findByIdAndUpdate(
      req.params.id,
      { 
        status: response,
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updatedInvitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    io.to(updatedInvitation.senderEmail).emit('invitation_response', updatedInvitation);
    // Optional external API call
    try {
      await axios.post('https://external-server.com/api/invitations', {
        sender: updatedInvitation.senderEmail,
        receiver: updatedInvitation.receiverEmail,
        event: updatedInvitation.eventData,
        status: response
      });
    } catch (extErr) {
      console.error('External API error:', extErr.message);
    }

    res.json(updatedInvitation);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};