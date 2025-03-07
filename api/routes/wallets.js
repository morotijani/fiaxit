const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");
const USDTController = require('../controllers/usdt-controller');
const BitcoinWalletService = require('../service/bitcoin-wallet-service');

// Usage (example): GET /api/v1/wallets
router.get('/', WalletsController.getAll()) // get all wallet address

// Usage (example): POST /api/v1/wallets/BTC/generate
router.post('/:id/generate', WalletsController.create()); // generate wallet address

// route grouping
router.route('/:id')
    .get(WalletsController.findById()) // get wallet address by id
    .delete(WalletsController.delete()); // delete wallet address

// Usage (example): GET /api/v1/wallets/usdt/0x1234567890abcdef1234567890abcdef12345678/balance
router.get('/usdt/:address/balance', USDTController.getBalance()); // get usdt balance
router.get('/btc/:address/balance', BitcoinWalletService.getWalletBalance()); // get btc balance

// Usage (example): POST /api/v1/wallets/usdt/send 
// {
//     "senderPrivateKey": "",
//     "receiverAddress": "",
//     "amount": "",
//     "isTestnet": true or false for mainnet
// }
router.post('/usdt/send', USDTController.sendUSDT()); // send usdt

// Usage (example): GET /api/v1/wallets/usdt/0x1234567890abcdef1234567890abcdef12345678/info
router.get('/usdt/:address/info', USDTController.getWalletInfo()); // get usdt wallet info

// Usage (example): GET /api/v1/wallets/btc/0x1234567890abcdef1234567890abcdef12345678/info
router.get('/btc/:address/info', BitcoinWalletService.getWalletInfo()); // get usdt wallet info

module.exports = router;