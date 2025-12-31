const Wallet = require("../models/wallet-model");
const Coin = require("../models/coin-model"); // added
const { v4: uuidv4 } = require('uuid')
const USDTService = require('../service/usdt-service');
const EthereumWalletService = require('../service/ethereum-wallet-service')
const BitcoinWalletService = require('../service/bitcoin-wallet-service');
const { encrypt, decrypt } = require('../helpers/encryption'); // added
const ethers = require('ethers');
const { default: axios, head } = require("axios");
const Transaction = require("../models/transaction-model");

class WalletsController {

    /**
     * Internal helper to fetch wallet balance without HTTP overhead
     */
    _fetchBalanceInternal = async (address, symbol, userData) => {
        if (!address) return 0;
        try {
            const cryptoSymbol = symbol.toUpperCase();
            const coin = await Coin.findOne({ where: { coin_symbol: cryptoSymbol } });
            const isTestnet = coin ? coin.coin_network !== 'mainnet' : (process.env.NODE_ENV !== 'production');

            // Execute balance check logic directly
            let rawData;
            const resMock = {
                status: () => resMock,
                json: (payload) => { rawData = payload; }
            };
            const reqMock = { params: { crypto: symbol, address }, userData };

            if (cryptoSymbol === 'BTC') {
                await BitcoinWalletService.getWalletBalance(address, isTestnet)(reqMock, resMock);
            } else if (cryptoSymbol === 'ETH' || (coin && (coin.coin_type === 'ETH' || coin.coin_type === 'ERC20'))) {
                const network = (coin && coin.coin_network) ? coin.coin_network : (isTestnet ? 'sepolia' : 'mainnet');
                EthereumWalletService.setNetwork(network);
                await EthereumWalletService.getWalletBalance()(reqMock, resMock);
            } else if (cryptoSymbol === 'USDT') {
                await USDTService.getWalletBalance()(reqMock, resMock);
            }

            const body = rawData || {};
            const payload = body.data ?? body.payload?.data ?? body.payload ?? body;

            if (typeof payload === 'object' && payload !== null) {
                const candidates = [
                    payload?.balance?.total,
                    payload?.balance?.btc,
                    payload?.balanceEth,
                    payload?.usdt?.balance,
                    payload?.balance?.eth,
                    payload?.balance,
                    payload?.amount,
                    payload?.value
                ];
                for (const c of candidates) {
                    if (c !== undefined && c !== null) {
                        const n = Number(c);
                        if (!isNaN(n) && typeof c !== 'object') return n;
                        if (typeof c === 'object' && c !== null) {
                            const nt = Number(c.total ?? c.btc ?? c.balance ?? 0);
                            if (!isNaN(nt)) return nt;
                        }
                    }
                }
            }
            return 0;
        } catch (err) {
            console.warn(`Internal balance fetch failed for ${symbol} ${address}:`, err.message || err);
            return 0;
        }
    };

    // get all wallets
    getAll = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id;
                const { count, rows } = await Wallet.findAndCountAll({
                    where: {
                        wallet_for: userId,
                        wallet_status: 0 // only active wallets
                    },
                    attributes: { exclude: ['wallet_privatekey', 'wallet_mnemonic'] },
                    order: [['createdAt', 'DESC']]
                });

                // Fetch balances in parallel (guarded) and attach results
                const settled = await Promise.allSettled(
                    rows.map(w => this._fetchBalanceInternal(w.wallet_address, w.wallet_symbol, req.userData))
                );

                for (let i = 0; i < rows.length; i++) {
                    const walletRow = rows[i];
                    let balanceNumeric = 0;
                    const r = settled[i];
                    if (r && r.status === 'fulfilled') {
                        balanceNumeric = Number(r.value) || 0;
                    } else {
                        console.warn(`Failed to fetch balance for row index ${i} (${walletRow.wallet_symbol} ${walletRow.wallet_address})`);
                        balanceNumeric = 0;
                    }
                    // attach to Sequelize instance safely
                    walletRow.dataValues = walletRow.dataValues || {};
                    walletRow.dataValues.wallet_balance = balanceNumeric;
                }

                // --- NEW: fetch unique current market prices (USD) for the returned wallet symbols ---
                const COINGECKO_ID_MAP = { ETH: 'ethereum', USDT: 'tether', BTC: 'bitcoin' };
                const uniqueSymbols = Array.from(new Set(rows.map(r => (r.wallet_symbol || '').toUpperCase()).filter(Boolean)));
                const ids = uniqueSymbols
                    .map(sym => COINGECKO_ID_MAP[sym] || sym.toLowerCase())
                    .filter(Boolean);
                let rates = {};
                if (ids.length > 0) {
                    try {
                        const idsParam = encodeURIComponent(ids.join(','));
                        const resp = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`);
                        const priceData = resp && resp.data ? resp.data : {};
                        // map back to symbols while avoiding duplicates
                        for (const sym of uniqueSymbols) {
                            const id = COINGECKO_ID_MAP[sym] || sym.toLowerCase();
                            const usd = priceData[id] && (priceData[id].usd ?? priceData[id].USD);
                            rates[sym] = { id, usd: (typeof usd === 'number' ? usd : null) };
                        }
                    } catch (err) {
                        console.warn("Failed to fetch CoinGecko prices:", err.message || err);
                        // rates stays empty on failure
                    }
                }

                res.status(200).json({
                    success: true,
                    method: "getAllWallet",
                    message: "All wallet displayed.",
                    data: rows,
                    total: count,
                    rates // <- added rates here, deduplicated by symbol
                })
            } catch (err) {
                res.status(422).json({
                    success: false,
                    method: "getAllWallet",
                    error: "Error occured fetching all wallets",
                    details: err.error || err.message || err
                })
            }
        }
    }

    // find by wallet id
    findById = () => {
        return async (req, res, next) => {
            const userId = req.userData.user_id;
            const walletId = req.params.id;

            const wallet = await Wallet.findOne({
                where: {
                    wallet_id: walletId,
                    wallet_for: userId
                }
            })
            const resp = {
                success: false,
                method: "findById",
                message: "Wallet not found!",
                wallet: null
            }
            if (wallet) {
                resp.success = true;
                resp.method = "findById";
                resp.message = "Wallet found!";
                // Exclude sensitive data
                const sanitizedWallet = wallet.toJSON();
                delete sanitizedWallet.wallet_privatekey;
                delete sanitizedWallet.wallet_mnemonic;
                resp.wallet = sanitizedWallet;
            }
            res.status(200).json(resp)
        }
    }

    // create
    generateWallet = () => {
        return async (req, res, next) => {
            try {
                const isTestnet = req.query.testnet !== 'false';
                const cryptoSymbol = req.params.crypto.toUpperCase();
                const userId = req.userData.user_id;
                const walletId = uuidv4();

                // 1. Fetch coin configuration from database
                const coin = await Coin.findOne({
                    where: { coin_symbol: cryptoSymbol, coin_status: true }
                });

                if (!coin) {
                    return res.status(404).json({
                        success: false,
                        message: `Coin ${cryptoSymbol} is not supported or active.`
                    });
                }

                // 2. Check if user already has a wallet for this coin
                const existing = await Wallet.findOne({
                    where: { wallet_for: userId, wallet_symbol: cryptoSymbol, wallet_status: 0 }
                });

                if (existing) {
                    return res.status(409).json({
                        success: false,
                        message: `You already have an active ${cryptoSymbol} wallet.`
                    });
                }

                let walletAddress = null;
                let walletPrivatekey = null;
                let walletMnemonic = null;
                let walletCryptoName = coin.coin_name;

                // 3. Generate wallet based on coin_type
                const coinType = coin.coin_type; // BTC, ETH, ERC20, etc.

                if (coinType === 'BTC') {
                    try {
                        const wallet = await BitcoinWalletService.generateWallet(isTestnet);
                        walletAddress = wallet.address;
                        walletPrivatekey = encrypt(wallet.privateKey);
                        walletMnemonic = encrypt(wallet.mnemonic);
                    } catch (error) {
                        throw new Error(`Failed to generate Bitcoin wallet: ${error.message}`);
                    }
                } else if (coinType === 'ETH' || coinType === 'ERC20') {
                    try {
                        // For ETH/ERC20 we use the same address generation
                        const network = isTestnet ? 'sepolia' : (coin.coin_network || 'mainnet');
                        EthereumWalletService.setNetwork(network);
                        const wallet = EthereumWalletService.generateWallet();

                        walletAddress = wallet.address;
                        walletPrivatekey = encrypt(wallet.privateKey);
                        walletMnemonic = encrypt(wallet.mnemonic);
                    } catch (error) {
                        throw new Error(`Failed to generate Ethereum-based wallet: ${error.message}`);
                    }
                } else if (coinType === 'TRC20') {
                    // For now fallback to USDT service or throw not implemented
                    try {
                        const wallet = USDTService.generateWallet();
                        walletAddress = wallet.address;
                        walletPrivatekey = encrypt(wallet.privateKey);
                        walletMnemonic = encrypt(wallet.mnemonic);
                    } catch (error) {
                        throw new Error(`Failed to generate TRC20 wallet: ${error.message}`);
                    }
                } else {
                    return res.status(400).json({
                        success: false,
                        error: `Wallet generation not implemented for coin type: ${coinType}`
                    });
                }

                const walletName = req.body.wallet_name || `Main ${cryptoSymbol} Wallet`;

                const newWallet = await Wallet.create({
                    wallet_id: walletId,
                    wallet_name: walletName,
                    wallet_for: userId,
                    wallet_symbol: cryptoSymbol,
                    wallet_crypto_name: walletCryptoName,
                    wallet_address: walletAddress,
                    wallet_privatekey: walletPrivatekey,
                    wallet_mnemonic: walletMnemonic
                });

                res.status(201).json({
                    success: true,
                    message: `${cryptoSymbol} wallet successfully generated.`,
                    wallet: {
                        wallet_id: newWallet.wallet_id,
                        wallet_address: newWallet.wallet_address,
                        wallet_symbol: newWallet.wallet_symbol,
                        wallet_crypto_name: newWallet.wallet_crypto_name
                    }
                });
            } catch (err) {
                console.error("Wallet generation error:", err);
                res.status(500).json({
                    success: false,
                    error: "Critical error during wallet generation",
                    details: err.message
                });
            }
        }
    }

    /**
                * Validate Ethereum address
        * @param {Object} req - Express request object
        * @param {Object} res - Express response object
    */
    validateETHAddress = (req, res) => {
        try {
            const { address } = req.params;

            if (!address) {
                return res.status(400).json({
                    success: false,
                    method: "validateETHAddress",
                    error: "Ethereum wallet address is required."
                });
            }

            const isValid = EthereumWalletService.isValidEthereumAddress(address);

            res.status(200).json({
                success: true,
                method: "validateETHAddress",
                message: "Ethereum wallet address validated.",
                data: {
                    address,
                    isValid
                }
            });
        } catch (error) {
            console.error("Address validation error:", error);
            res.status(422).json({
                success: false,
                error: "There was a problem validating Ethereum wallet address.",
                details: error.message || "An error occurred while validating the Ethereum wallet address",
            });
        }
    }

    /**
     * Unified Get Wallet Balance
     */
    getWalletBalance = () => {
        return async (req, res, next) => {
            try {
                const { crypto, address } = req.params;
                const cryptoSymbol = crypto.toUpperCase();

                // 1. Fetch coin configuration to get network
                const coin = await Coin.findOne({ where: { coin_symbol: cryptoSymbol } });
                const isTestnet = coin ? coin.coin_network !== 'mainnet' : (process.env.NODE_ENV !== 'production');

                // 2. Route to appropriate service
                if (cryptoSymbol === 'BTC') {
                    return BitcoinWalletService.getWalletBalance(address, isTestnet)(req, res, next);
                } else if (cryptoSymbol === 'ETH' || (coin && coin.coin_type === 'ERC20')) {
                    const network = (coin && coin.coin_network) ? coin.coin_network : (isTestnet ? 'sepolia' : 'mainnet');
                    EthereumWalletService.setNetwork(network);
                    return EthereumWalletService.getWalletBalance()(req, res, next);
                } else if (cryptoSymbol === 'USDT') {
                    return USDTService.getWalletBalance()(req, res, next);
                }

                res.status(400).json({ success: false, message: `Balance check not supported for ${cryptoSymbol}` });
            } catch (err) {
                console.error("getWalletBalance Error:", err);
                res.status(500).json({ success: false, error: err.message });
            }
        }
    }

    /**
     * Unified Get Wallet Info (Balance + History)
     */
    getWalletInfo = () => {
        return async (req, res, next) => {
            try {
                const { crypto, address } = req.params;
                const cryptoSymbol = crypto.toUpperCase();

                const coin = await Coin.findOne({ where: { coin_symbol: cryptoSymbol } });
                const isTestnet = coin ? coin.coin_network !== 'mainnet' : (process.env.NODE_ENV !== 'production');

                if (cryptoSymbol === 'BTC') {
                    return BitcoinWalletService.getWalletInfo(address, isTestnet)(req, res, next);
                } else if (cryptoSymbol === 'ETH' || (coin && (coin.coin_type === 'ETH' || coin.coin_type === 'ERC20'))) {
                    const network = (coin && coin.coin_network) ? coin.coin_network : (isTestnet ? 'sepolia' : 'mainnet');
                    EthereumWalletService.setNetwork(network);
                    return EthereumWalletService.getWalletInfo()(req, res, next);
                } else if (cryptoSymbol === 'USDT') {
                    return USDTService.getWalletInfo()(req, res, next);
                }

                res.status(400).json({ success: false, message: `Info retrieval not supported for ${cryptoSymbol}` });
            } catch (err) {
                console.error("getWalletInfo Error:", err);
                res.status(500).json({ success: false, error: err.message });
            }
        }
    }

    // update
    update = () => {
        return async (req, res, next) => {
            // Start a database transaction for data integrity
            const dbTransaction = await Transaction.sequelize.transaction();

            try {
                const userId = req.userData.user_id;
                const transactionId = req.params.id;

                // Find the transaction within the transaction context
                const transaction = await Transaction.findOne({
                    where: {
                        transaction_id: transactionId,
                        transaction_by: userId
                    },
                    transaction: dbTransaction
                });

                if (!transaction) {
                    await dbTransaction.rollback();
                    return res.status(404).json({
                        success: false,
                        method: "updateTransaction",
                        message: "Transaction not found or you don't have permission to update it."
                    });
                }

                // Prevent updates to completed/processed transactions
                if (transaction.transaction_status > 1) {
                    await dbTransaction.rollback();
                    return res.status(400).json({
                        success: false,
                        method: "updateTransaction",
                        message: "Cannot update a processed transaction."
                    });
                }

                // Build update object with only provided fields
                const updateFields = {};
                const allowedFields = [
                    'transaction_amount',
                    'transaction_crypto_id',
                    'transaction_crypto_symbol',
                    'transaction_crypto_name',
                    'transaction_crypto_price',
                    'transaction_to_wallet_address',
                    'transaction_message'
                ];

                allowedFields.forEach(field => {
                    if (req.body[field] !== undefined) {
                        updateFields[field] = req.body[field];
                    }
                });

                if (Object.keys(updateFields).length === 0) {
                    await dbTransaction.rollback();
                    return res.status(400).json({
                        success: false,
                        method: "update",
                        message: "No valid fields provided for update."
                    });
                }

                // Update within transaction context
                await transaction.update(updateFields, { transaction: dbTransaction });

                // Commit the transaction
                await dbTransaction.commit();

                res.status(200).json({
                    success: true,
                    method: "update",
                    message: "Transaction updated successfully.",
                    data: {
                        transaction: transaction
                    }
                });
            } catch (err) {
                // Rollback on error
                await dbTransaction.rollback();
                console.error("Transaction update error:", err);
                res.status(422).json({
                    success: false,
                    error: "There was a problem updating transaction.",
                    details: err.message || "An error occurred during transaction update."
                });
            }
        }
    }

    // delete
    delete = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id;
                const transactionId = req.params.id;
                const transaction = await Transaction.findOne({
                    where: {
                        transaction_id: transactionId,
                        transaction_by: userId
                    }
                });
                const resp = {
                    success: false,
                    method: "deleteTransaction",
                    message: "Transaction not found.",
                    data: {
                        transaction: null
                    }
                }
                if (transaction) {
                    await transaction.destroy();
                    resp.success = true;
                    resp.method = "delete";
                    resp.msg = "Transaction deleted.";
                }
                res.status(200).json(resp)
            } catch (err) {
                console.error("Transaction deletion error:", err);
                res.status(422).json({
                    success: false,
                    error: "Something went wrong, please try again.",
                    details: err.message || "An error occurred during transaction deletion."
                });
            }
        }
    }

    // get all wallet balance by using getAll function to loop through each wallet address and get their balance ad sum them together as one 
    getTotalBalance = () => {
        return async (req, res, next) => {
            // function to get rate of crypto using external service APIs
            const getCryptoRate = async (symbol, fiat) => {
                symbol = symbol.toLowerCase() ?? '';
                fiat = fiat.toLowerCase() ?? 'usd';
                try {
                    const resp = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol}&vs_currencies=${fiat}`);
                    // const exchangeRate = response.data[cryptoId][fiatId];
                    const rate = resp.data && resp.data[symbol] && resp.data[symbol][fiat];
                    console.log(`Fetched rate for ${symbol.toUpperCase()}/${fiat.toUpperCase()}:`, rate);
                    return rate || 1;

                } catch (error) {
                    console.error("Error fetching crypto rate:", error);
                }
                return 1; // Placeholder implementation
            };

            try {
                const userId = req.userData.user_id;
                const wallets = await Wallet.findAll({
                    where: {
                        wallet_for: userId,
                        wallet_status: 0 // only active wallets
                    }
                });

                const totals = {};

                for (const wallet of wallets) {
                    const symbol = wallet.wallet_symbol;
                    const address = wallet.wallet_address;

                    const numeric = await this._fetchBalanceInternal(address, symbol, req.userData);

                    if (!totals[symbol]) {
                        totals[symbol] = {};
                    }

                    totals[symbol]['amount'] = (totals[symbol]['amount'] || 0) + numeric;
                    totals[symbol]['name'] = (wallet.wallet_crypto_name || symbol).toLowerCase();

                    // robust map for coingecko
                    const COINGECKO_MAP = { eth: 'ethereum', btc: 'bitcoin', usdt: 'tether' };
                    const rateId = COINGECKO_MAP[totals[symbol]['name']] || totals[symbol]['name'];

                    // Fetch and store fiat equivalent
                    const rate = await getCryptoRate(rateId, 'usd');
                    const fiatEquivalent = ((totals[symbol]['amount'] || 0) * rate);
                    totals[symbol]['fiat_equivalent'] = fiatEquivalent;
                }

                // --- ADDED: Include Internal Balances ---
                const internalBalances = await UserBalance.findAll({ where: { user_id: userId } });
                for (const ib of internalBalances) {
                    const symbol = ib.coin_symbol;
                    if (!totals[symbol]) {
                        totals[symbol] = { amount: 0, name: symbol.toLowerCase(), fiat_equivalent: 0 };
                    }
                    const amount = parseFloat(ib.balance);
                    totals[symbol].amount += amount;

                    // Add to fiat total if symbol rate exists
                    const COINGECKO_MAP = { eth: 'ethereum', btc: 'bitcoin', usdt: 'tether' };
                    const rateId = COINGECKO_MAP[symbol.toLowerCase()] || symbol.toLowerCase();
                    const rate = await getCryptoRate(rateId, 'usd');
                    totals[symbol].fiat_equivalent += (amount * rate);
                }


                return res.status(200).json({
                    success: true,
                    method: "getTotalBalance",
                    message: "Successfully fetched all wallet balances.",
                    data: totals
                });
            } catch (err) {
                console.error("Error fetching wallets:", err);
                return res.status(500).json({
                    success: false,
                    method: "getTotalBalance",
                    error: "Failed to fetch wallets.",
                    details: err.message || "An error occurred while fetching wallets."
                });
            }
        }
    }

    // Get Internal Balances (Custodial)
    getInternalBalances = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const balances = await UserBalance.findAll({ where: { user_id: userId } });
                res.status(200).json({ success: true, data: balances });
            } catch (err) {
                res.status(500).json({ success: false, message: "Failed to fetch internal balances" });
            }
        };
    }

    // Deposit from non-custodial wallet to internal balance
    depositToInternal = () => {
        return async (req, res) => {
            // This would involve a real transaction on-chain to our platform wallet
            // For now, we'll mark it as a "processed" deposit for the user's manual simulation
            res.status(200).json({ success: true, message: "Deposit feature initiated. Please send funds to our pool address." });
        };
    }
}

module.exports = new WalletsController()