const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");
const usdtController = require('../controllers/usdt-controller');

// route grouping
router.route('/') 
    .get(WalletsController.getAll()) // get all wallet address

router.route('/:id')
    .post(WalletsController.create()) // generate wallet address
    .get(WalletsController.findById()) // get wallet address by id
    .delete(WalletsController.delete()); // delete wallet address

// Generate new wallet
// Usage (example): POST /api/v1/wallets/usdt/generate
router.post('/usdt/generate', usdtController.generateWallet());

// Get USDT balance
// Usage (example): GET /api/v1/wallets/usdt/0x1234567890abcdef1234567890abcdef12345678/balance
router.get('/usdt/:address/balance', usdtController.getBalance());

// Send USDT
// Usage (example): POST /api/v1/wallets/usdt/send
router.post('/usdt/send', usdtController.sendUSDT());

// Get wallet info with transaction history
router.get('/usdt/:address/info', usdtController.getWalletInfo());

module.exports = router;