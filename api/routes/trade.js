const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");
const USDTController = require('../middleware/usdt-controller')
const BitcoinWalletService = require('../service/bitcoin-wallet-service');
const ethereumController = require('../middleware/ethereum-controller');

// Routes
router.post('/wallet/generate', ethereumController.generateWallet);
router.get('/wallet/:address/balance', ethereumController.getWalletBalance);
router.get('/wallet/:address/info', ethereumController.getWalletInfo);
router.post('/wallet/send', ethereumController.sendEther);
router.get('/validate/:address', ethereumController.validateAddress);

module.exports = router;