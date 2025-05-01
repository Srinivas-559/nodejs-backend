const express = require('express');
const router = express.Router();
const classifiedController = require('../controllers/classifiedControllers');

// Create a classified
router.post('/', classifiedController.createClassified);

// Get classifieds with filters
router.get('/', classifiedController.getClassifieds);

// Get classifieds posted by a specific user
router.get('/user/:email', classifiedController.getClassifiedsByUser);

// Get single classified by ID
router.get('/:id', classifiedController.getClassifiedById);

// Add viewers to a classified
router.post('/:id/viewers', classifiedController.addViewers);

// Remove all viewers from a classified (except poster)
router.delete('/:id/viewers', classifiedController.removeViewers);

// Delete a classified
router.delete('/:id', classifiedController.deleteClassified);

module.exports = router;
