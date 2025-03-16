const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");
const BitcoinWalletService = require('../service/bitcoin-wallet-service');
const USDTService = require('../service/usdt-service');
const EthereumWalletService = require('../service/ethereum-wallet-service')

// Usage (example): POST /api/v1/wallets/:crypto/generate?testnet=true(default is true) | (on ETH you can provide your network eg: ?network=networkname)
router.post('/:crypto/generate', WalletsController.generateWallet()); // generate wallet address


/** USDT */
// Usage (example): GET /api/v1/wallets/usdt/:address/balance?testnet=true (default is true)
router.get('/usdt/:address/balance', USDTService.getWalletBalance()); // get usdt balance
// Usage (example): GET /api/v1/wallets/usdt/:address/info?testnet=true (default is true)
router.get('/usdt/:address/info', USDTService.getWalletInfo()); // get usdt wallet info


/** BTC */
// Usage (example): GET /api/v1/wallets/btc/:address/info?testnet=true
router.get('/btc/:address/info', BitcoinWalletService.getWalletInfo()); // get btc wallet info
// Usage (example): GET /api/v1/wallets/btc/:address/balance?testnet=true
router.get('/btc/:address/balance', BitcoinWalletService.getWalletBalance()); // get btc balance


/** ETH */ 
// Usage (example): GET /api/v1/wallets/eth/:address/balance
router.get('/eth/:address/balance', EthereumWalletService.getWalletBalance()); // get eth balance
// Usage (example): GET /api/v1/wallets/eth/:address/info
router.get('/eth/:address/info', EthereumWalletService.getWalletInfo()); // get eth wallet info
// Usage (example): GET /api/v1/wallets/eth/:address/validate
router.get('/eth/:address/validate', WalletsController.validateETHAddress); // validate eth address


// Usage (example): GET /api/v1/wallets
router.get('/', WalletsController.getAll()) // get all wallet address

// route grouping
router.route('/:id')
    .get(WalletsController.findById()) // get wallet address by id
    .delete(WalletsController.delete()); // delete wallet address

module.exports = router;