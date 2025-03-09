const express = require('express');
const router = express.Router();
const ethereumController = require('../middleware/ethereum-controller');

// Routes
router.post('/wallet/generate', ethereumController.generateWallet);
router.get('/wallet/:address/balance', ethereumController.getWalletBalance);
router.get('/wallet/:address/info', ethereumController.getWalletInfo);
router.post('/wallet/send', ethereumController.sendEther);
router.get('/validate/:address', ethereumController.validateAddress);

module.exports = router;