const express = require('express');
const router = express.Router();
const PortfolioController = require('../controllers/portfolio-controller');
const userAuth = require('../middleware/check-auth');

router.get('/history', userAuth.authenticate, PortfolioController.getHistory());
router.post('/snapshot', userAuth.authenticate, PortfolioController.takeSnapshot());

module.exports = router;
