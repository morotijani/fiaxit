const Wallet = require("../models/wallet-model");
const { v4: uuidv4 } = require('uuid')
const USDTService = require('../service/usdt-service');
const EthereumWalletService = require('../service/ethereum-wallet-service')
const BitcoinWalletService = require('../service/bitcoin-wallet-service');
const ethers = require('ethers'); // added
const { default: axios, head } = require("axios");

class WalletsController {

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
                    order: [['createdAt', 'DESC']]
                });

                // robust single-address fetcher with normalization and timeout
                const fetchWalletBalance = async (address, symbol) => {
                    if (!address) return 0;
                    const token = req.headers.authorization?.split(' ')[1] || '';
                    const url = `http://sites.local:8000/v1/wallets/${encodeURIComponent(symbol)}/${encodeURIComponent(address)}/balance`;
                    try {
                        const resp = await axios.get(url, {
                            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                            timeout: 5000
                        });
                        const body = resp && resp.data ? resp.data : {};
                        // support multiple shapes: { data: { ... } }, { payload: { data: { ... } } }, or direct
                        const payload = body.data ?? body.payload?.data ?? body.payload ?? body;
                        // Normalize common shapes
                        if (symbol === 'ETH') {
                            const val = payload?.balanceEth ?? payload?.balance ?? payload?.eth?.balance ?? payload?.balance?.eth;
                            return Number(val ?? 0) || 0;
                        }
                        if (symbol === 'USDT') {
                            const val = payload?.usdt?.balance ?? payload?.balance ?? payload?.balance?.usdt;
                            return Number(val ?? 0) || 0;
                        }
                        if (symbol === 'BTC') {
                            // btc might be nested under balance.btc or returned as btc
                            const val = payload?.balance?.btc ?? payload?.balance ?? payload?.btc ?? payload?.btcBalance;
                            // some services return strings; ensure numeric
                            return Number(val ?? 0) || 0;
                        }
                        // generic fallback: try any numeric field
                        if (typeof payload === 'object') {
                            const candidates = [payload?.balance, payload?.amount, payload?.value, payload?.balanceEth];
                            for (const c of candidates) {
                                if (c !== undefined && c !== null && !isNaN(Number(c))) return Number(c);
                            }
                        }
                        return 0;
                    } catch (err) {
                        console.warn(`Balance fetch failed for ${symbol} ${address}:`, err.message || err);
                        return 0;
                    }
                };

                // Fetch balances in parallel (guarded) and attach results
                const settled = await Promise.allSettled(
                    rows.map(w => fetchWalletBalance(w.wallet_address, w.wallet_symbol))
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
            } catch(err) {
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
                resp.wallet = wallet;
            }
            res.status(200).json(resp)
        }
    }

    // create
    generateWallet = () => {
        return async (req, res, next) => {
            try {
                const isTestnet = req.query.testnet !== 'false'; // Default to testnet=true
                const crypto = req.params.crypto;
                const userId = req.userData.user_id;
                const walletId = uuidv4();
                
                // Default empty wallet data
                let walletXpub = null;
                let walletAddress = null;
                let encryptedData = null; // For storing encrypted sensitive data if needed
                let walletPrivatekey = null;
                let walletMnemonic = null;
                
                if (crypto === 'BTC') {
                    try {
                        const wallet = await BitcoinWalletService.generateWallet(isTestnet);
                        // const wallet = walletResponse.wallet;
                        console.log('Generated wallet:', wallet);
                        
                        walletXpub = null;
                        walletAddress = wallet.address
                        walletPrivatekey = wallet.privateKey // For development only
                        walletMnemonic = wallet.mnemonic; // For development only
                        walletCryptoName = 'Bitcoin';
                        
                        // For development only - log sensitive data (REMOVE IN PRODUCTION)
                        // if (process.env.NODE_ENV !== 'production') {
                        //     console.log('DEVELOPMENT MODE - Sensitive wallet data:');
                        //     console.log('Private Key:', xpriv.privateKey.toString());
                        //     console.log('Mnemonic:', passPhrase.toString());
                        // }
                    } catch (error)  {
                        return res.status(500).json({
                            success: false, 
                            error: "Failed to generate Bitcoin wallet", 
                            details: error.message
                        })
                    }
                } else if (crypto === 'USDT') {
                    try {
                        const wallet = USDTService.generateWallet();
                        walletXpub = null 
                        walletAddress = wallet.address
                        walletPrivatekey = wallet.privateKey
                        walletMnemonic = wallet.mnemonic
                        walletCryptoName = 'Tether USD';
                        
                        console.log("USDT Wallet generated:", wallet);
                    } catch (error) {
                        console.error("USDT Wallet generation error:", error);
                        res.status(500).json({
                            success: false, 
                            error: "Failed to generate USDT wallet", 
                            details: error.message
                        });
                    }
                } else if (crypto === 'ETH') {
                    // Ethereum wallet generation
                    try {
			            // Check if a specific network was requested
                        const network = ((isTestnet) ? 'sepolia' : req.query.network);
                        if (network) {
                            EthereumWalletService.setNetwork(network);
                        } else {
                            return res.status(400).json({
                                success: false,
                                error: "Network is required for Ethereum wallet generation"
                            });
                        }

                        const wallet = EthereumWalletService.generateWallet();
                        
                        walletAddress = wallet.address;
                        walletPrivatekey = wallet.privateKey;
                        walletMnemonic = wallet.mnemonic;
                        walletCryptoName = 'Ethereum';
                        
                        console.log("Generated ETH wallet:", wallet);
                    } catch (error) {
                        console.error("ETH Wallet generation error:", error);
                        res.status(500).json({
                            success: false,
                            error: "Failed to generate Ethereum wallet", 
                            details: error.message
                        });
                    }
                    
                } else {
                    return res.status(400).json({
                        success: false,
                        method: "createAndGenerate" + crypto +"Wallet",
                        error: "Invalid crypto currency provided"
                    });
                }
                
                const wallet = await Wallet.create({
                    wallet_id: walletId, 
                    wallet_for: userId, 
                    wallet_symbol: crypto, 
                    wallet_crypto_name: walletCryptoName,
                    wallet_xpub: walletXpub, 
                    wallet_address: walletAddress, 
                    wallet_privatekey: walletPrivatekey,
                    wallet_mnemonic: walletMnemonic
                });
                
                res.status(201).json({
                    success: true,
                    method: "createAndGenerate"+crypto+"Wallet",
                    message: `${crypto} Wallet address successfully generated.`, 
                    wallet: wallet
                });
            } catch(err) {
                console.error(crypto + " wallet address creation error:", err);
                res.status(422).json({
                    success: false,
                    error: "There was an error generating " + crypto + " wallet", 
                    details: err.message || "An error occurred during wallet address creation"
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
            } catch(err) {
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
            // helper: call middleware-style getWalletBalance and capture JSON response
            const callMiddleware = async (service, address) => {
                try {
                    if (!service || typeof service.getWalletBalance !== 'function') return null;
                    const mw = service.getWalletBalance();
                    return await new Promise((resolve) => {
                        const reqMock = { params: { address } };
                        const resMock = {
                            _status: 200,
                            status(code) { this._status = code; return this; },
                            json(payload) { resolve({ status: this._status || 200, payload }); }
                        };
                        try {
                            const maybe = mw(reqMock, resMock);
                            if (maybe && typeof maybe.then === 'function') {
                                // middleware is async; it will resolve via resMock.json
                            }
                        } catch (e) {
                            resolve({ status: 500, error: e });
                        }
                    });
                } catch (err) {
                    return { status: 500, error: err };
                }
            };

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
                    let numeric = 0;

                    try {
                        if (!address) {
                            console.warn(`Skipping wallet with no address (symbol=${symbol})`);
                            continue;
                        }

                        // ETH: prefer direct provider.getBalance
                        if (symbol === 'ETH') {
                            try {
                                if (EthereumWalletService && EthereumWalletService.provider && typeof EthereumWalletService.provider.getBalance === 'function') {
                                    const bal = await EthereumWalletService.provider.getBalance(address);
                                    numeric = parseFloat(ethers.formatEther(bal)) || 0;
                                } else {
                                    const resp = await callMiddleware(EthereumWalletService, address);
                                    const data = resp && resp.payload && resp.payload.data;
                                    numeric = parseFloat(data?.balanceEth ?? data?.eth?.balance ?? data?.balance ?? 0) || 0;
                                }
                            } catch (e) {
                                console.warn(`ETH balance fetch failed for ${address}:`, e.message);
                                const resp = await callMiddleware(EthereumWalletService, address);
                                const data = resp && resp.payload && resp.payload.data;
                                numeric = parseFloat(data?.balanceEth ?? data?.eth?.balance ?? 0) || 0;
                            }
                        }

                        // USDT: call USDT service middleware (or direct func if implemented)
                        else if (symbol === 'USDT') {
                            let resp;
                            try {
                                // Some services expose direct function; attempt it first
                                if (typeof USDTService.getWalletBalance === 'function' && USDTService.getWalletBalance.length === 0) {
                                    // if it's middleware-style, call via helper
                                    resp = await callMiddleware(USDTService, address);
                                } else {
                                    resp = await callMiddleware(USDTService, address);
                                }
                            } catch (e) {
                                resp = await callMiddleware(USDTService, address);
                            }
                            const data = resp && resp.payload && resp.payload.data;
                            const flat = resp && resp.payload ? resp.payload : resp;
                            numeric = parseFloat(data?.usdt?.balance ?? flat?.data?.usdt?.balance ?? flat?.data?.balance ?? 0) || 0;
                        }

                        // BTC: call Bitcoin middleware
                        else if (symbol === 'BTC') {
                            let resp;
                            try {
                                resp = await callMiddleware(BitcoinWalletService, address);
                            } catch (e) {
                                resp = await callMiddleware(BitcoinWalletService, address);
                            }
                            const data = resp && resp.payload && resp.payload.data;
                            const flat = resp && resp.payload ? resp.payload : resp;
                            // Bitcoin returns btc under data.balance.btc or data.balance.btc string
                            numeric = parseFloat(data?.balance?.btc ?? flat?.data?.balance?.btc ?? flat?.data?.balance ?? 0) || 0;
                        }

                        // Fallback: try all services' middleware to find any numeric field
                        else {
                            const resp = await callMiddleware(EthereumWalletService, address) || await callMiddleware(USDTService, address) || await callMiddleware(BitcoinWalletService, address);
                            const data = resp && resp.payload && resp.payload.data;
                            numeric = parseFloat(data?.balance ?? data?.balanceEth ?? data?.usdt?.balance ?? 0) || 0;
                        }
                    } catch (innerErr) {
                        console.error(`Error fetching balance for ${symbol} ${address}:`, innerErr && innerErr.message);
                        numeric = 0;
                    }
                    
                    if (!totals[symbol]) {
                        totals[symbol] = {};
                    }
                    
                    totals[symbol]['amount'] = (totals[symbol]['amount'] || 0) + numeric;
                    totals[symbol]['name'] = wallet.wallet_crypto_name || null;
                    // Fetch and store fiat equivalent
                    const rate = await getCryptoRate(totals[symbol]['name'], 'usd');
                    const fiatEquivalent = ((totals[symbol]['amount'] || 0) * rate);
                    totals[symbol]['fiat_equivalent'] = fiatEquivalent;
                    
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

}

module.exports = new WalletsController()