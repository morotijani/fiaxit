const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");

// Usage (example): POST /api/v1/wallets/:crypto/generate
router.post('/:crypto/generate', WalletsController.generateWallet()); // generate wallet address

/** Unified Coin Info & Balance */
// Usage: GET /api/v1/wallets/:crypto/:address/balance
router.get('/:crypto/:address/balance', WalletsController.getWalletBalance());
// Usage: GET /api/v1/wallets/:crypto/:address/info
router.get('/:crypto/:address/info', WalletsController.getWalletInfo());

/** ETH specific */
// Usage (example): GET /api/v1/wallets/eth/:address/validate
router.get('/eth/:address/validate', WalletsController.validateETHAddress);

router.get('/total-balance', WalletsController.getTotalBalance());
router.get('/internal-balances', WalletsController.getInternalBalances());

// Usage (example): GET /api/v1/wallets
router.get('/', WalletsController.getAll()) // get all wallet address

// route grouping
router.route('/:id')
    .get(WalletsController.findById()) // get wallet address by id
    .delete(WalletsController.delete()); // delete wallet address

module.exports = router;