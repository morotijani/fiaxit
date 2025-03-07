const express = require('express');
const router = express.Router();
const TransactionsController = require("../controllers/transaction-controller");

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

// route grouping
router.route('/') 
    .get(TransactionsController.getAll()) // get all transactions

router.route('/:id')
    .get(TransactionsController.findById()) // get transaction by id
    .patch(TransactionsController.update()) // update transaction
    .delete(TransactionsController.delete()); // delete transaction

module.exports = router;