const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

router.post('/create', eventController.createEvent);
// router.post('/join', eventController.joinEvent);
router.get('/participated/:email', eventController.getParticipatedEvents);
router.get('/organized/:email', eventController.getOrganizedEvents); // New route
router.delete('/:eventId', eventController.deleteEvent); // New DELETE route

module.exports = router;