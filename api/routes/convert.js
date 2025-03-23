const express = require('express');
const router = express.Router();
const ConvertController = require('../controllers/converter-controller');

// Convert crypto currency to fiat (GET method)
router.get('/:cryptoCurrency/:fiatCurrency/:amount', ConvertController.convertCurrency());

// Convert crypto currency to fiat (POST method)
router.post('/convert', ConvertController.convert());

// Get supported cryptocurrencies
router.get('/supported/cryptocurrencies', ConvertController.getSupportedCryptos());

// Get supported fiat currencies
router.get('/supported/fiat', ConvertController.getSupportedFiat());

// Get historical exchange rates
router.get('/historical/:cryptoCurrency/:fiatCurrency/:days', ConvertController.getHistoricalRates());

// Get current rate
router.get('/current/:cryptoCurrency/:fiatCurrency', ConvertController.getCurrentRate());

module.exports = router;
