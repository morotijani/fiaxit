const express = require('express');
const router = express.Router();
const WalletsController = require("../controllers/wallet-controller");

// router.post('/update/:id', userAuth, UserController.update());

// route grouping
router.route('/') 
    .get(WalletsController.getAll()) // get all wallet address

router.route('/:id')
    .post(WalletsController.create()) // generate wallet address
    .get(WalletsController.findById()) // get wallet address by id
    // .patch(WalletsController.update()) // update transaction
    // .delete(WalletsController.delete()); // delete wallet address

module.exports = router;