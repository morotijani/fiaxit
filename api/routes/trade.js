const express = require('express');
const router = express.Router();
const USDTController = require('../middleware/usdt-controller')
const ethereumController = require('../middleware/ethereum-controller');
const TransactionsController = require("../controllers/transaction-controller");

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

// Usage (example): POST /api/v1/eth/send
/** BODY
    {
        "from": "0x4d2e7b1b2b5b3d0c4f3c0d4f7f5f2d3d4f3c0d4f",
        "to": "0x4d2e7b1b2b5b3d0c4f3c0d4f7f5f2d3d4f3c0d4f",
        "amount": "0.00002",
        "privateKey": "cNbyXtwdDX2P8dFjmP5HLptfhv6C8ExyT7Z5zYL8KLfnwVsLfKh7",
        "gasPrice": "0",
        "note": "good transaction"
    }
*/
router.post('/eth/send', TransactionsController.create()); // send eth
module.exports = router;