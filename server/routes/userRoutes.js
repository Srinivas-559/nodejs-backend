const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Specific routes must come before generic routes with params
router.get('/activity/:email', userController.getUserActivity);
router.get('/:name', userController.getAllUsers);

module.exports = router;