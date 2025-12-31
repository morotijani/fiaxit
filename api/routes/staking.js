const express = require('express');
const router = express.Router();
const StakingController = require('../controllers/staking-controller');
const userAuth = require("../middleware/check-auth");

router.post('/stake', userAuth.authenticate, StakingController.stake());
router.get('/my-stakes', userAuth.authenticate, StakingController.getMyStakes());
router.post('/admin/calculate-interest', userAuth.authenticate, userAuth.isAdmin, StakingController.calculateInterest());

module.exports = router;
