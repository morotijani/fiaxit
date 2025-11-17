const axios = require('axios');

class ConvertController {
    // Convert cryptocurrency to fiat currency
    convertCurrency = () => {
        return async (req, res, next) => {
            try {
                const { fromCurrency, toCurrency, amount, direction = 'crypto-to-fiat' } = req.params;
                
                // Validate input parameters
                if (!fromCurrency || !toCurrency || !amount) {
                    return res.status(400).json({
                        success: false, 
                        method: "convertCurrency", 
                        message: "Missing required parameters: fromCurrency, toCurrency, and amount are required."
                    });
                }
                
                // Validate amount is a positive number
                if (isNaN(amount) || parseFloat(amount) <= 0) {
                    return res.status(400).json({
                        success: false, 
                        method: "convertCurrency", 
                        message: "Amount must be a positive number."
                    });
                }
                
                // Determine which is crypto and which is fiat based on direction
                let cryptoId, fiatId;
                let fromIsCrypto = true;
                
                if (direction === 'fiat-to-crypto') {
                    cryptoId = toCurrency.toLowerCase();
                    fiatId = fromCurrency.toLowerCase();
                    fromIsCrypto = false;
                } else {
                    // Default: crypto-to-fiat
                    cryptoId = fromCurrency.toLowerCase();
                    fiatId = toCurrency.toLowerCase();
                    fromIsCrypto = true;
                }
                
                // Fetch current exchange rate from CoinGecko API
                const response = await axios.get(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${fiatId}`
                );
                
                // Check if the requested cryptocurrency exists in the response
                if (!response.data[cryptoId]) {
                    return res.status(404).json({
                        success: false, 
                        method: "convertCurrency", 
                        message: `Cryptocurrency '${fromIsCrypto ? fromCurrency : toCurrency}' not found.`
                    });
                }
                
                // Check if the requested fiat currency exists in the response
                if (!response.data[cryptoId][fiatId]) {
                    return res.status(404).json({
                        success: false, 
                        method: "convertCurrency", 
                        message: `Currency '${fromIsCrypto ? toCurrency : fromCurrency}' not found.`
                    });
                }
                
                // Get the exchange rate
                const exchangeRate = response.data[cryptoId][fiatId];
                
                // Calculate the converted amount based on direction
                let convertedAmount;
                if (fromIsCrypto) {
                    // Crypto to fiat: multiply by exchange rate
                    convertedAmount = parseFloat(amount) * exchangeRate;
                } else {
                    // Fiat to crypto: divide by exchange rate
                    convertedAmount = parseFloat(amount) / exchangeRate;
                }
                
                // Return the result
                return res.status(200).json({
                    success: true, 
                    method: "convertCurrency", 
                    data: { 
                        from: { 
                            currency: fromCurrency, 
                            amount: parseFloat(amount) 
                        }, 
                        to: { 
                            currency: toCurrency, 
                            amount: convertedAmount 
                        }, 
                        exchangeRate: exchangeRate,
                        conversionDirection: direction,
                        timestamp: new Date()
                    }
                });
                
            } catch(error) {
                console.error('Error in currency conversion:', error);
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    if (error.response.status === 429) {
                        return res.status(429).json({
                            success: false,
                            method: "convertCurrency",
                            message: "Rate limit exceeded. Please try again later."
                        });
                    }

                    return res.status(error.response.status).json({
                        success: false,
                        method: "convertCurrency",
                        message: "An error occurred during currency conversion.",
                        details: error.response.data
                    });
                }
                
                return res.status(500).json({
                    success: false,
                    method: "convertCurrency",
                    message: "An error occurred during currency conversion.",
                    details: error.message
                });
            }
        }
    }

    
    // Get supported cryptocurrencies
    getSupportedCryptos = () => {
        return async (req, res, next) => {
            try {
                // Fetch list of supported cryptocurrencies from CoinGecko
                const response = await axios.get('https://api.coingecko.com/api/v3/coins/list');
                
                return res.status(200).json({
                    success: true,
                    method: "getSupportedCryptos", 
                    data: response.data
                });
            } catch(error) {
                console.error('Error fetching supported cryptocurrencies:', error);
                return res.status(500).json({
                    success: false,
                    method: "getSupportedCryptos", 
                    message: "An error occurred while fetching supported cryptocurrencies.", 
                    details: error.message
                });
            }
        }
    }

    // Get supported fiats
    getSupportedFiat = () => {
        return async (req, res, next) => {
            // Fetch list of supported fiats from CoinGekco
            try {
                const response = await axios.get('https://api.coingecko.com/api/v3/simple/supported_vs_currencies');

                res.status(200).json({
                    success: true,
                    method: "getSupportedFiat", 
                    data: response.data
                })

            } catch(error) {
                console.error('Error fetching supported fiats:', error);
                return res.status(500).json({
                    success: false,
                    method: "getSupportedFiat", 
                    message: "An error occurred while fetching supported fiats.", 
                    details: error.message
                });
            }
        }
    }
    
    // Get historical rates
    getHistoricalRates = () => {
        return async (req, res, next) => {
            try {
                // Extract query parameters
                const { cryptoId, vsCurrency, days, interval } = req.query;
                
                // Validate required parameters
                if (!cryptoId || !vsCurrency) {
                    return res.status(400).json({
                        success: false,
                        method: "getHistoricalRates",
                        message: "Missing required parameters: cryptoId and vsCurrency are required."
                    });
                }
                
                // Set default values for optional parameters
                // 'days' parameter: number of days to look back (1, 7, 14, 30, 90, 180, 365, max)
                // 'interval' parameter: data interval (daily, hourly, etc.)
                const daysParam = days || '30';
                const intervalParam = interval || 'daily';
                
                // Convert parameters to lowercase for API compatibility
                const crypto = cryptoId.toLowerCase();
                const currency = vsCurrency.toLowerCase();
                
                // Fetch historical market data from CoinGecko API
                // Using the /coins/{id}/market_chart endpoint which provides historical data
                const response = await axios.get(
                    `https://api.coingecko.com/api/v3/coins/${crypto}/market_chart`,
                    {
                        params: {
                            vs_currency: currency,
                            days: daysParam,
                            interval: intervalParam
                        }
                    }
                );
                
                // Process the response data
                // CoinGecko returns prices as an array of [timestamp, price] pairs
                const historicalData = response.data.prices.map(item => {
                    const timestamp = new Date(item[0]);
                    return {
                        date: timestamp.toISOString().split('T')[0], // Format as YYYY-MM-DD
                        time: timestamp.toISOString(),
                        price: item[1]
                    };
                });
                
                // Group data by date for daily intervals
                let formattedData = historicalData;
                if (intervalParam === 'daily') {
                    const groupedByDate = {};
                    
                    historicalData.forEach(item => {
                        const date = item.date;
                        if (!groupedByDate[date]) {
                            groupedByDate[date] = item;
                        }
                    });
                    
                    formattedData = Object.values(groupedByDate);
                }
                
                // Return the result
                return res.status(200).json({
                    success: true,
                    method: "getHistoricalRates",
                    data: {
                        cryptoCurrency: cryptoId,
                        fiatCurrency: vsCurrency,
                        interval: intervalParam,
                        timespan: `${daysParam} days`,
                        rates: formattedData
                    }
                });
                
            } catch (error) {
                console.error('Error fetching historical rates:', error);
                
                // Handle specific API errors
                if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    if (error.response.status === 404) {
                        return res.status(404).json({
                            success: false,
                            method: "getHistoricalRates",
                            message: `Cryptocurrency '${req.query.cryptoId}' not found.`
                        });
                    }
                    
                    if (error.response.status === 429) {
                        return res.status(429).json({
                            success: false,
                            method: "getHistoricalRates",
                            message: "Rate limit exceeded. Please try again later."
                        });
                    }
                }
                
                // Generic error response
                return res.status(500).json({
                    success: false,
                    method: "getHistoricalRates",
                    message: "An error occurred while fetching historical rates.",
                    details: error.message
                });
            }
        }
    }

    // Get current exchange rate between a cryptocurrency and a fiat currency
    getCurrentRate = () => {
        return async (req, res, next) => {
            try {
                // Extract query parameters
                const { cryptoId, vsCurrency } = req.query;
                
                // Validate required parameters
                if (!cryptoId || !vsCurrency) {
                    return res.status(400).json({
                        success: false,
                        method: "getCurrentRate",
                        message: "Missing required parameters: cryptoId and vsCurrency are required."
                    });
                }
                
                // Convert parameters to lowercase for API compatibility
                const crypto = cryptoId.toLowerCase();
                const currency = vsCurrency.toLowerCase();
                
                // Fetch current exchange rate from CoinGecko API
                const response = await axios.get(
                    `https://api.coingecko.com/api/v3/simple/price`,
                    {
                        params: {
                            ids: crypto,
                            vs_currencies: currency,
                            include_market_cap: true,
                            include_24hr_vol: true,
                            include_24hr_change: true,
                            include_last_updated_at: true
                        }
                    }
                );
                
                // Check if the requested cryptocurrency exists in the response
                if (!response.data[crypto]) {
                    return res.status(404).json({
                        success: false,
                        method: "getCurrentRate",
                        message: `Cryptocurrency '${cryptoId}' not found.`
                    });
                }
                
                // Check if the requested currency exists in the response
                if (!response.data[crypto][currency]) {
                    return res.status(404).json({
                        success: false,
                        method: "getCurrentRate",
                        message: `Currency '${vsCurrency}' not found.`
                    });
                }
                
                // Extract data from response
                const data = response.data[crypto];
                
                // Format the response
                const result = {
                    cryptoCurrency: cryptoId,
                    fiatCurrency: vsCurrency,
                    rate: data[currency],
                    marketCap: data[`${currency}_market_cap`],
                    volume24h: data[`${currency}_24h_vol`],
                    change24h: data[`${currency}_24h_change`],
                    lastUpdated: new Date(data.last_updated_at * 1000).toISOString()
                };
                
                // Return the result
                return res.status(200).json({
                    success: true,
                    method: "getCurrentRate",
                    data: result,
                    timestamp: new Date()
                });
                
            } catch (error) {
                console.error('Error fetching current rate:', error);
                
                // Handle specific API errors
                if (error.response) {
                    if (error.response.status === 429) {
                        return res.status(429).json({
                            success: false,
                            method: "getCurrentRate",
                            message: "Rate limit exceeded. Please try again later."
                        });
                    }
                }
                
                // Generic error response
                return res.status(500).json({
                    success: false,
                    method: "getCurrentRate",
                    message: "An error occurred while fetching the current exchange rate.",
                    details: error.message
                });
            }
        }
    }

    // coin cap get cryptocurrency lastest listing
    getCoinCapLatestListings = () => {
        const apiKey = process.env.REACT_APP_CMC_API_KEY;

        return async (req, res, next) => {
            try {
                if (!apiKey) {
                    return res.status(500).json({
                        success: false,
                        method: "getCoinCapLatestListings",
                        message: "CoinMarketCap API key not configured."
                    });
                }

                // Extract query parameters
                const { start, limit, convert } = req.query;

                const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
                const params = {
                    start: start || '1',
                    limit: limit || '10',
                    convert: convert || 'USD'
                };

                // Use axios params and inspect status/data from axios response
                const response = await axios.get(url, {
                    headers: {
                        'X-CMC_PRO_API_KEY': apiKey,
                        'Accept': 'application/json'
                    },
                    params
                });

                if (!response || typeof response.status === 'undefined') {
                    throw new Error('No response from CoinMarketCap');
                }

                if (response.status < 200 || response.status >= 300) {
                    throw new Error(`CMC ${response.status} ${response.statusText || ''}`.trim());
                }

                const json = response.data;

                const quoteCurrency = (params.convert || 'USD').toUpperCase();

                const mapped = (json.data || []).map(a => {
                    const quote = a.quote && a.quote[quoteCurrency] ? a.quote[quoteCurrency] : {};
                    const price = Number(quote.price || 0);
                    const change = Number(quote.percent_change_24h || 0);
                    // coin icon from CoinMarketCap static CDN by id
                    const icon = `https://s2.coinmarketcap.com/static/img/coins/64x64/${a.id}.png`;
                    return {
                        id: a.id,
                        name: a.name,
                        symbol: a.symbol,
                        price,
                        change,
                        icon
                    }
                });

                return res.status(200).json({
                    success: true,
                    method: "getCoinCapLatestListings",
                    data: mapped
                });

            } catch (error) {
                console.error('Failed to load assets from CoinMarketCap', error);

                // Handle specific API errors
                if (error.response) {
                    if (error.response.status === 429) {
                        return res.status(429).json({
                            success: false,
                            method: "getCoinCapLatestListings",
                            message: "Rate limit exceeded. Please try again later."
                        });
                    }
                    // forward CMC status if present
                    return res.status(error.response.status || 500).json({
                        success: false,
                        method: "getCoinCapLatestListings",
                        message: error.response.statusText || 'CoinMarketCap error',
                        details: error.response.data || error.message
                    });
                }

                // Generic error response
                return res.status(500).json({
                    success: false,
                    method: "getCoinCapLatestListings",
                    message: "An error occurred while fetching CoinMarketCap listings.",
                    details: error.message
                });
            }
        }
    }

    // get coin info using symbol
    getCoinLatestInfoBySymbol = () => {
        const apiKey = process.env.REACT_APP_CMC_API_KEY;

        return async (req, res, next) => {
            try {
                if (!apiKey) {
                    return res.status(500).json({
                        success: false,
                        method: "getCoinCapLatestListings",
                        message: "CoinMarketCap API key not configured."
                    });
                }

                // Extract symbol parameter
                const { symbol } = req.params;
                if (!symbol) {
                    return res.status(400).json({
                        success: false,
                        method: "getCoinLatestInfoBySymbol",
                        message: "Missing required parameter: symbol."
                    });
                }

                // const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/info';
                const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
                const params = {
                    symbol: symbol.toUpperCase()
                };
                const response = await axios.get(url, {
                    headers: {
                        'X-CMC_PRO_API_KEY': apiKey, 
                        'Accept': 'application/json'
                    },
                    params
                });

                if (!response || typeof response.status === 'undefined') {
                    throw new Error('No response from CoinMarketCap');
                }

                if (response.status < 200 || response.status >= 300) {
                    throw new Error(`CMC ${response.status} ${response.statusText || ''}`.trim());
                }

                const json = response.data;
                const coinData = json.data && json.data[params.symbol] ? json.data[params.symbol] : null;
                if (!coinData) {
                    return res.status(404).json({
                        success: false,
                        method: "getCoinLatestInfoBySymbol",
                        message: `Cryptocurrency with symbol '${symbol}' not found.`
                    });
                }

                return res.status(200).json({
                    success: true,
                    method: "getCoinLatestInfoBySymbol",
                    data: coinData
                });
            } catch (error) {
                console.error('Failed to load coin details from CoinMarketCap', error);
                if (error.response) {
                    if (error.response.status === 429) {
                        return res.status(429).json({
                            success: false,
                            method: "getCoinLatestInfoBySymbol",
                            message: "Rate limit exceeded. Please try again later."
                        });
                    }

                    return res.status(error.response.status || 500).json({
                        success: false,
                        method: "getCoinLatestInfoBySymbol",
                        message: error.response.statusText || 'CoinMarketCap error',
                        details: error.response.data || error.message
                    });
                }

                return res.status(500).json({
                    success: false,
                    method: "getCoinLatestInfoBySymbol",
                    message: "An error occurred while fetching coin details.",
                    details: error.message
                });
            }
        }
    }

    // get single coin details
    getSingleCoinDetails = () => {
        const apiKey = process.env.REACT_APP_CMC_API_KEY;

        return async (req, res, next) => {
            try {
                if (!apiKey) {
                    return res.status(500).json({
                        success: false,
                        method: "getCoinCapLatestListings",
                        message: "CoinMarketCap API key not configured."
                    });
                }

                // Extract id, currency parameter
                const { id, convert } = req.params;
                if (!id) {
                    return res.status(400).json({
                        success: false,
                        method: "getSingleCoinDetails",
                        message: "Missing required parameter: id."
                    });
                }

                const url = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest';
                const params = {
                    id: id, 
                    convert: convert || 'USD'
                };
                const response = await axios.get(url, {
                    headers: {
                        'X-CMC_PRO_API_KEY': apiKey, 
                        'Accept': 'application/json'
                    },
                    params
                });

                if (!response || typeof response.status === 'undefined') {
                    throw new Error('No response from CoinMarketCap');
                }

                if (response.status < 200 || response.status >= 300) {
                    throw new Error(`CMC ${response.status} ${response.statusText || ''}`.trim());
                }

                const json = response.data;
                const coinData = json.data && json.data[params.id] ? json.data[params.id] : null;
                if (!coinData) {
                    return res.status(404).json({
                        success: false,
                        method: "getSingleCoinDetails",
                        message: `Cryptocurrency with id '${id}' not found.`
                    });
                }

                return res.status(200).json({
                    success: true,
                    method: "getSingleCoinDetails",
                    data: coinData
                });
            } catch (error) {
                console.error('Failed to load coin details from CoinMarketCap', error);
                if (error.response) {
                    if (error.response.status === 429) {
                        return res.status(429).json({
                            success: false,
                            method: "getSingleCoinDetails",
                            message: "Rate limit exceeded. Please try again later."
                        });
                    }

                    return res.status(error.response.status || 500).json({
                        success: false,
                        method: "getSingleCoinDetails",
                        message: error.response.statusText || 'CoinMarketCap error',
                        details: error.response.data || error.message
                    });
                }

                return res.status(500).json({
                    success: false,
                    method: "getSingleCoinDetails",
                    message: "An error occurred while fetching coin details.",
                    details: error.message
                });
            }
        }
    }

    // get coin statistics by id and range
    getCoinStatisticsByIdAndRange = () => {
        const apiKey = process.env.COINSTATS_API_KEY;

        return async (req, res, next) => {
            try {
                if (!apiKey) {
                    return res.status(500).json({
                        success: false,
                        method: "getCoinStatisticsByIdAndRange",
                        message: "Coinstats API key not configured."
                    });
                }

                // Extract id, currency parameter
                const { period, id } = req.params;
                if (!id) {
                    return res.status(400).json({
                        success: false,
                        method: "getCoinStatisticsByIdAndRange",
                        message: "Missing required parameter: id."
                    });
                }

               const url = `https://openapiv1.coinstats.app/coins/${id}/charts`;
                const params = {
                    period: period || '1m'
                };
                const response = await axios.get(url, {
                    headers: {
                        'X-API-KEY': apiKey, 
                        'Accept': 'application/json'
                    },
                    params
                });

                if (!response || typeof response.status === 'undefined') {
                    throw new Error('No response from CoinStats');
                }

                if (response.status < 200 || response.status >= 300) {
                    throw new Error(`CoinStats ${response.status} ${response.statusText || ''}`.trim());
                }

                const json = response.data;
                const coinData = json ? json : null;
                if (!coinData) {
                    console.error('CoinStats response missing chart data', json);
                    return res.status(404).json({
                        success: false,
                        method: "getCoinStatisticsByIdAndRange",
                        message: `Cryptocurrency with id '${id}' not found.`
                    });
                }

                return res.status(200).json({
                    success: true,
                    method: "getCoinStatisticsByIdAndRange",
                    data: coinData, 
                    timestamp: new Date()
                });
            } catch (error) {
                console.error('Failed to load coin statistics from CoinStats', error);
                  if (error.response) {
                    if (error.response.status === 429) {
                        return res.status(429).json({
                            success: false,
                            method: "getCoinStatisticsByIdAndRange",
                            message: "Rate limit exceeded. Please try again later."
                        });
                    }

                    return res.status(error.response.status || 500).json({
                        success: false,
                        method: "getCoinStatisticsByIdAndRange",
                        message: error.response.statusText || 'CoinStats error',
                        details: error.response.data || error.message
                    });
                }

                return res.status(500).json({
                    success: false,
                    method: "getCoinStatisticsByIdAndRange",
                    message: "An error occurred while fetching coin statistics.",
                    details: error.message
                });
            }
        }
    }
}

module.exports = new ConvertController();