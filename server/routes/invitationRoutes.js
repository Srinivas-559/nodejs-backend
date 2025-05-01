const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');

router.post('/', (req, res) => {
  invitationController.createInvitation(req, res, req.app.get('io'));
});

router.get('/sent/:email', invitationController.getSentInvitations);
router.get('/received/:email', invitationController.getReceivedInvitations);

router.put('/:id/respond', (req, res) => {
  invitationController.respondToInvitation(req, res, req.app.get('io'));
});

module.exports = router;