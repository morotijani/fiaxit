const express = require('express');
const router = express.Router();
const coinController = require('../controllers/coin-controller');
const { authenticate, isAdmin } = require('../middleware/check-auth');

// Public: Get all coins
router.get('/', coinController.getAllPins());

// Admin: Add a coin
router.post('/', authenticate, isAdmin, coinController.addCoin());

// Admin: Update a coin
router.patch('/:id', authenticate, isAdmin, coinController.updateCoin());

module.exports = router;
