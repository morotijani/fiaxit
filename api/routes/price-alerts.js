const express = require('express');
const router = express.Router();
const PriceAlertController = require('../controllers/price-alert-controller');
const userAuth = require('../middleware/check-auth');

router.get('/', userAuth.authenticate, PriceAlertController.getAll());
router.post('/', userAuth.authenticate, PriceAlertController.create());
router.delete('/:id', userAuth.authenticate, PriceAlertController.delete());

module.exports = router;
