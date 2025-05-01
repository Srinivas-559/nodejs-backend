const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.get('/', messageController.getMessages);
router.get('/latest-chats', messageController.getLatestChats);
router.post('/clear', messageController.clearChat);

module.exports = router;