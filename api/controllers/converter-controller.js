const axios = require('axios');

class ConvertController {
    // Convert cryptocurrency to fiat currency
    convertCurrency = () => {
        return async (req, res, next) => {
            try {
                const { cryptoCurrency, fiatCurrency, amount } = req.params;
                
                // Validate input parameters
                if (!cryptoCurrency || !fiatCurrency || !amount) {
                    return res.status(400).json({
                        success: false, 
                        method: "convertCurrency", 
                        message: "Missing required parameters: cryptoCurrency, fiatCurrency, and amount are required."
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
                
                // Convert cryptocurrency ID to lowercase for API compatibility
                const cryptoId = cryptoCurrency.toLowerCase();
                // Convert fiat currency to lowercase for API compatibility
                const fiatId = fiatCurrency.toLowerCase();
                
                // Fetch current exchange rate from CoinGecko API
                const response = await axios.get(
                    `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${fiatId}`
                );
                
                // Check if the requested cryptocurrency exists in the response
                if (!response.data[cryptoId]) {
                    return res.status(404).json({
                        success: false, 
                        method: "convertCurrency", 
                        message: `Cryptocurrency '${cryptoCurrency}' not found.`
                    });
                }
                
                // Check if the requested fiat currency exists in the response
                if (!response.data[cryptoId][fiatId]) {
                    return res.status(404).json({
                        success: false, 
                        method: "convertCurrency", 
                        message: `Fiat currency '${fiatCurrency}' not found.`
                    });
                }
                
                // Get the exchange rate
                const exchangeRate = response.data[cryptoId][fiatId];
                
                // Calculate the converted amount
                const convertedAmount = parseFloat(amount) * exchangeRate;
                
                // Return the result
                return res.status(200).json({
                    success: true, 
                    method: "convertCurrency", 
                    data: { 
                        from: { 
                            currency: cryptoCurrency, 
                            amount: parseFloat(amount) 
                        }, 
                        to: { 
                            currency: fiatCurrency, 
                            amount: convertedAmount 
                        }, 
                        exchangeRate: exchangeRate, 
                        timestamp: new Date()
                    }
                });
                
            } catch(error) {
                console.error('Error in currency conversion:', error);
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

}

module.exports = new ConvertController();