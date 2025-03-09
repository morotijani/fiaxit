const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");
const USDTController = require('../middleware/usdt-controller')
const BitcoinWalletService = require('../service/bitcoin-wallet-service');
const ethereumController = require('../middleware/ethereum-controller');

// Routes

// Usage (example): POST /api/v1/wallets/usdt/send 
// {
//     "senderPrivateKey": "",
//     "receiverAddress": "",
//     "amount": "",
//     "isTestnet": true or false for mainnet
// }
router.post('/usdt/send', USDTController.sendUSDT()); // send usdt

// Usage (example): GET /api/v1/transactions/send?testnet=false
/** BODY
    {
        "crypto_id": "1",
        "crypto_symbol": "BTC",
        "crypto_name": "BITCOIN", 
        "crypto_price": "6744443.32", 
        "toAddress": "mmo2VZPn9brnKHsUMr56T4GCCtkkXTMFa4",
        "privateKey": "cNbyXtwdDX2P8dFjmP5HLptfhv6C8ExyT7Z5zYL8KLfnwVsLfKh7",
        "amount": "0.00002",
        "feeRate": "0",
        "note": "good transaction"
    }
*/
router.post('/send', TransactionsController.create()); // send transaction (send crypto)


router.post('/eth/send', ethereumController.sendEther);
module.exports = router;