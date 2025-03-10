const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");
const USDTController = require('../middleware/usdt-controller');
const BitcoinWalletService = require('../service/bitcoin-wallet-service');
const ethereumController = require('../middleware/ethereum-controller');

// Usage (example): POST /api/v1/wallets/BTC/generate?testnet=true(default is true) | (on ETH you can provide your network eg: ?network=networkname)
router.post('/:id/generate', WalletsController.generateWallet()); // generate wallet address


/** USDT */
// Usage (example): GET /api/v1/wallets/usdt/:address/balance
router.get('/usdt/:address/balance', USDTController.getBalance()); // get usdt balance
// Usage (example): GET /api/v1/wallets/usdt/:address/info
router.get('/usdt/:address/info', USDTController.getWalletInfo()); // get usdt wallet info


/** BTC */
// Usage (example): GET /api/v1/wallets/btc/:address/info
router.get('/btc/:address/info', WalletsController.getWalletInfo()); // get btc wallet info
// Usage (example): GET /api/v1/wallets/btc/:address/balance
router.get('/btc/:address/balance', BitcoinWalletService.getWalletBalance()); // get btc balance


/** ETH */ 
// Usage (example): GET /api/v1/wallets/eth/:address/balance
router.get('/eth/:address/balance', ethereumController.getWalletBalance); // get eth balance
// Usage (example): GET /api/v1/wallets/eth/:address/info
router.get('/eth/:address/info', ethereumController.getWalletInfo); // get eth wallet info
// Usage (example): GET /api/v1/wallets/eth/:address/validate
router.get('/eth/:address/validate', ethereumController.validateAddress); // validate eth address


// Usage (example): GET /api/v1/wallets
router.get('/', WalletsController.getAll()) // get all wallet address

// route grouping
router.route('/:id')
    .get(WalletsController.findById()) // get wallet address by id
    .delete(WalletsController.delete()); // delete wallet address

module.exports = router;