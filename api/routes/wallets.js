const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");

// route grouping
router.route('/') 
    .get(WalletsController.getAll()) // get all wallet address

router.route('/:id')
    .post(WalletsController.create()) // generate wallet address
    .get(WalletsController.findById()) // get wallet address by id
    .delete(WalletsController.delete()); // delete wallet address

module.exports = router;