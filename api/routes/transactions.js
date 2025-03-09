const express = require('express');
const router = express.Router();
const TransactionsController = require("../controllers/transaction-controller");


// route grouping
router.route('/') 
    .get(TransactionsController.getAll()) // get all transactions

router.route('/:id')
    .get(TransactionsController.findById()) // get transaction by id
    .patch(TransactionsController.update()) // update transaction
    .delete(TransactionsController.delete()); // delete transaction

module.exports = router;