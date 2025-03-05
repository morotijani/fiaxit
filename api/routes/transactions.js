const express = require('express');
const router = express.Router();
const TransactionsController = require("../controllers/transaction-controller");

router.post('/send-crypto', TransactionsController.create());
router.get('/wallet/:address/balance', TransactionsController.getWalletBalance());

// Optional: with query parameter for testnet/mainnet
// Example usage: /wallet/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa/balance?testnet=false


// route grouping
router.route('/') 
    .get(TransactionsController.getAll()) // get all transactions
    // .post(TransactionsController.create()); // post or send transaction (send crypto)

router.route('/:id')
    .get(TransactionsController.findById()) // get transaction by id
    .patch(TransactionsController.update()) // update transaction
    .delete(TransactionsController.delete()); // delete transaction

module.exports = router;