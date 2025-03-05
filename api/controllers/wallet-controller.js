const Wallet = require("../models/wallet-model");
const { v4: uuidv4 } = require('uuid')
const bitcore = require('bitcore-lib');
const { PrivateKey, Networks } = bitcore;
const  Mnemonic = require('bitcore-mnemonic');

class WalletsController {

    // get all method
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
                    method: "getAll",
                    data: rows,
                    total: count
                })
            } catch(err) {
                res.status(422).json(err.error)
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
                msg: "Wallet not found!", 
                wallet: null
            }
            if (wallet) {
                resp.success = true;
                resp.method = "findById";
                resp.msg = "Wallet found!";
                resp.wallet = wallet;
            }
            res.status(200).json(resp)
        }
    }

    // create
    create = () => {
        return async (req, res, next) => {
            try {
                const crypto = req.params.id;
                const userId = req.userData.user_id;
                const walletId = uuidv4();
                
                // Default empty wallet data
                let walletXpub = null;
                let walletAddress = null;
                let encryptedData = null; // For storing encrypted sensitive data if needed
                
                if (crypto === 'BTC') {
                    // Use testnet for development, mainnet for production
                    const network = process.env.NODE_ENV === 'production' ? Networks.mainnet : Networks.testnet;
                    
                    // Create a single HD wallet
                    const passPhrase = new Mnemonic(Mnemonic.Words.SPANISH);
                    const xpriv = passPhrase.toHDPrivateKey(passPhrase.toString(), network);
                    
                    // Store only public information in database
                    walletXpub = xpriv.xpubkey;
                    walletAddress = xpriv.publicKey.toAddress().toString();

                    // encrypt privateKey and passPhrase
                    // encryptedData = {
                    //     privateKey: xpriv.privateKey.toString(),
                    //     mnemonic: passPhrase.toString()
                    // }
                    
                    // For development only - log sensitive data (REMOVE IN PRODUCTION)
                    if (process.env.NODE_ENV !== 'production') {
                        console.log('DEVELOPMENT MODE - Sensitive wallet data:');
                        console.log('Private Key:', xpriv.privateKey.toString());
                        console.log('Mnemonic:', passPhrase.toString());
                    }
                    
                    // In a real application, you might encrypt sensitive data with a user-provided key
                    // or use a secure vault service instead of storing in your database
                } else if (crypto === 'USDT') {
                    
                }
                
                const wallet = await Wallet.create({
                    wallet_id: walletId, 
                    wallet_for: userId, 
                    wallet_crypto: crypto, 
                    wallet_xpub: walletXpub, 
                    wallet_address: walletAddress, 
                    wallet_encrypted_data: encryptedData
                });
                
                res.status(201).json({
                    success: true,
                    method: "create",
                    wallet: wallet
                });
            } catch(err) {
                console.error("Wallet address creation error:", err);
                res.status(422).json({
                    success: false,
                    error: err.message || "An error occurred during wallet address creation"
                });
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
                        method: "update",
                        message: "Transaction not found or you don't have permission to update it."
                    });
                }
                
                // Prevent updates to completed/processed transactions
                if (transaction.transaction_status > 1) {
                    await dbTransaction.rollback();
                    return res.status(400).json({
                        success: false,
                        method: "update",
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
                    transaction: transaction
                });
            } catch(err) {
                // Rollback on error
                await dbTransaction.rollback();
                console.error("Transaction update error:", err);
                res.status(422).json({
                    success: false,
                    error: err.message || "An error occurred during transaction update"
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
                    method: "delete", 
                    msg: "Transaction not found.", 
                    transaction: null
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
                    error: err.message || "An error occurred during transaction deletion"
                });
            }
        }
    }
}

module.exports = new WalletsController()