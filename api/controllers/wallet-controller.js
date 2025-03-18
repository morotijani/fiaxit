const Wallet = require("../models/wallet-model");
const { v4: uuidv4 } = require('uuid')
const USDTService = require('../service/usdt-service');
const EthereumWalletService = require('../service/ethereum-wallet-service')
const BitcoinWalletService = require('../service/bitcoin-wallet-service');

class WalletsController {

    // get all wallets
    getAll = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id;
                const { count, rows } = await Wallet.findAndCountAll({
                    where: {
                        wallet_for: userId
                    },
                    order: [['createdAt', 'DESC']]
                });
                
                res.status(200).json({
                    success: true, 
                    method: "getAllWallet", 
                    message: "All wallet displayed.", 
                    data: rows, 
                    total: count
                })
            } catch(err) {
                res.status(422).json({
                    success: false, 
                    method: "getAllWallet",
                    error: "Error occured fetching all wallets", 
                    details: err.error
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
                    wallet_crypto: crypto, 
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

}

module.exports = new WalletsController()