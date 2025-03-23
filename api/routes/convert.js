const express = require('express');
const router = express.Router();
const ConvertController = require('../controllers/converter-controller');

// Convert crypto currency to fiat (GET method)
router.get('/:cryptoCurrency/:fiatCurrency/:amount', ConvertController.convertCurrency());

// Convert crypto currency to fiat (POST method)
router.post('/convert', ConvertController.convertCurrency());

// Get supported cryptocurrencies
router.get('/supported/cryptocurrencies', ConvertController.getSupportedCryptos());

// Get supported fiat currencies
router.get('/supported/fiat', ConvertController.getSupportedFiat());

// Get historical exchange rates /:cryptoCurrency/:fiatCurrency/:days
router.get('/historical', ConvertController.getHistoricalRates());

// Get current rate /:cryptoCurrency/:fiatCurrency
router.get('/current', ConvertController.getCurrentRate());

module.exports = router;
