const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');


// Group CRUD operations
router.post('/', groupController.createGroup);
router.get('/:groupId', groupController.getGroupDetails);
router.put('/:groupId', groupController.updateGroupInfo);
router.delete('/:groupId', groupController.deleteGroup);

// Member management
router.post('/:groupId/members', groupController.addMembers);
router.delete('/:groupId/members/:userId', groupController.removeMember);

// Admin management
router.post('/:groupId/admins', groupController.addAdmin);
router.delete('/:groupId/admins/:userId', groupController.removeAdmin);

// Group messages
router.get('/:groupId/messages', groupController.getGroupMessages);

module.exports = router;