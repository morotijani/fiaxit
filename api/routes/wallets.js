const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");
const USDTController = require('../middleware/usdt-controller');
const BitcoinWalletService = require('../service/bitcoin-wallet-service');
const ethereumController = require('../middleware/ethereum-controller');

// Usage (example): GET /api/v1/wallets
router.get('/', WalletsController.getAll()) // get all wallet address

// Usage (example): POST /api/v1/wallets/BTC/generate
router.post('/:id/generate', WalletsController.generateWallet()); // generate wallet address

// Usage (example): GET /api/v1/wallets/usdt/:address/balance
router.get('/usdt/:address/balance', USDTController.getBalance()); // get usdt balance
router.get('/btc/:address/balance', BitcoinWalletService.getWalletBalance()); // get btc balance

// Usage (example): GET /api/v1/wallets/usdt/:address/info
router.get('/usdt/:address/info', USDTController.getWalletInfo()); // get usdt wallet info

// Usage (example): GET /api/v1/wallets/btc/:address/info
router.get('/btc/:address/info', WalletsController.getWalletInfo()); // get btc wallet info

// route grouping
router.route('/:id')
    .get(WalletsController.findById()) // get wallet address by id
    .delete(WalletsController.delete()); // delete wallet address


// ETH
router.post('/ETH/generate', WalletsController.generateWallet());
router.get('/eth/:address/balance', ethereumController.getWalletBalance);
router.get('/eth/:address/info', ethereumController.getWalletInfo);
router.get('/eth/:address/validate', ethereumController.validateAddress);

module.exports = router;