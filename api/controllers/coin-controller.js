const Coin = require('../models/coin-model');
const { v4: uuidv4 } = require('uuid');

class CoinController {
    // Get all supported coins
    getAllPins = () => {
        return async (req, res) => {
            try {
                const coins = await Coin.findAll({
                    where: { coin_status: true }
                });
                res.status(200).json({
                    success: true,
                    data: coins
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to fetch coins.",
                    error: error.message
                });
            }
        };
    }

    // Admin: Add a new coin
    addCoin = () => {
        return async (req, res) => {
            try {
                const { name, symbol, type, contract_address, network, icon } = req.body;

                if (!name || !symbol || !type) {
                    return res.status(400).json({
                        success: false,
                        message: "Name, symbol, and type are required."
                    });
                }

                const coin = await Coin.create({
                    coin_id: uuidv4(),
                    coin_name: name,
                    coin_symbol: symbol.toUpperCase(),
                    coin_type: type,
                    coin_contract_address: contract_address,
                    coin_network: network || 'mainnet',
                    coin_icon: icon
                });

                res.status(201).json({
                    success: true,
                    message: "Coin added successfully.",
                    data: coin
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to add coin.",
                    error: error.message
                });
            }
        };
    }

    // Admin: Update a coin
    updateCoin = () => {
        return async (req, res) => {
            try {
                const { id } = req.params;
                const updates = req.body;

                const coin = await Coin.findOne({ where: { coin_id: id } });
                if (!coin) {
                    return res.status(404).json({
                        success: false,
                        message: "Coin not found."
                    });
                }

                if (updates.symbol) updates.coin_symbol = updates.symbol.toUpperCase();
                if (updates.name) updates.coin_name = updates.name;
                if (updates.type) updates.coin_type = updates.type;
                if (updates.status !== undefined) updates.coin_status = updates.status;

                await coin.update(updates);

                res.status(200).json({
                    success: true,
                    message: "Coin updated successfully.",
                    data: coin
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update coin.",
                    error: error.message
                });
            }
        };
    }

    // Seed initial coins
    seedInitialCoins = async () => {
        const initialCoins = [
            { id: 'btc-id', name: 'Bitcoin', symbol: 'BTC', type: 'BTC', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png' },
            { id: 'eth-id', name: 'Ethereum', symbol: 'ETH', type: 'ETH', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png' },
            { id: 'usdt-id', name: 'Tether', symbol: 'USDT', type: 'ERC20', icon: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png' }
        ];

        for (const c of initialCoins) {
            await Coin.findOrCreate({
                where: { coin_symbol: c.symbol },
                defaults: {
                    coin_id: uuidv4(),
                    coin_name: c.name,
                    coin_symbol: c.symbol,
                    coin_type: c.type,
                    coin_icon: c.icon
                }
            });
        }
    }
}

module.exports = new CoinController();
