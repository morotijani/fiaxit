const express = require('express');
const router = express.Router();
const TransactionsController = require("../controllers/transaction-controller");

router.post('/send', TransactionsController.create());

// route grouping
router.route('/') 
    .get(TransactionsController.getAll()) // get all transactions
    // .post(TransactionsController.create()); // post or send transaction (send crypto)

router.route('/:id')
    .get(TransactionsController.findById()) // get transaction by id
    .patch(TransactionsController.update()) // update transaction
    .delete(TransactionsController.delete()); // delete transaction

module.exports = router;