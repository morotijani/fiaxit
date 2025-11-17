const express = require('express');
const router = express.Router();
const ConvertController = require('../controllers/converter-controller');

// Convert crypto currency to fiat (POST method)
// router.post('/converter', ConvertController.convertCurrency());

// Get supported cryptocurrencies
router.get('/supported/cryptocurrencies', ConvertController.getSupportedCryptos());

// Get supported fiat currencies
router.get('/supported/fiat', ConvertController.getSupportedFiat());

// Get historical exchange rates /:cryptoCurrency/:fiatCurrency/:days
router.get('/historical', ConvertController.getHistoricalRates());

// Get current rate /:cryptoCurrency/:fiatCurrency
router.get('/current', ConvertController.getCurrentRate());

// coin market cap latest listings /coinmarketcap/listings/latest with params ?start=1&limit=100&convert=USD
router.get('/coinmarketcap/listings/latest', ConvertController.getCoinCapLatestListings());

// coin market cap info for a specific cryptocurrency /coinmarketcap/info/:symbol
router.get('/coinmarketcap/latest/:symbol', ConvertController.getCoinLatestInfoBySymbol());
//https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC

// coin market cap details for a specific cryptocurrency by id /coinmarketcap/latest/:id
router.get('/coin/:id', ConvertController.getSingleCoinDetails());

// coinstats chart with params /coinstats/chart/:coinId/:currency/:period
router.get('/chart/coin/:period/:id', ConvertController.getCoinStatisticsByIdAndRange());

// Convert crypto currency to fiat (GET method)
router.get('/:fromCurrency/:toCurrency/:amount/:direction', ConvertController.convertCurrency());

module.exports = router;