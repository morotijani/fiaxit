const Transaction = require("../models/transaction-model");
const { v4: uuidv4 } = require('uuid')
const axios = require("axios")
const bitcore = require("bitcore-lib")
const { sendCrypto } = require('../routes/send-crypto');


class TransactionsController {

    // get all method
    getAll = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id;
                const { count, rows } = await Transaction.findAndCountAll({
                    where: {
                        transaction_by: userId
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

    // find by transaction id
    findById = () => {
        return async (req, res, next) => {
            const userId = req.userData.user_id;
            const transactionId = req.params.id;

            const transaction = await Transaction.findOne({
                where: {
                    transaction_id: transactionId, 
                    transaction_by: userId
                }
            })
            const resp = {
                success: false,
                method: "findById", 
                msg: "Transaction not found!", 
                transaction: null
            }
            if (transaction) {
                resp.success = true;
                resp.method = "findById";
                resp.msg = "Transaction found!";
                resp.transaction = transaction;
            }
            res.status(200).json(resp)
        }
    }

    // create
    create = () => {
        return async (req, res, next) => {
            // Example usage (DO NOT include private keys in your code - this is just for illustration)
            // async function example() {
            //     const result = await sendCrypto(
            //         'privateKeyInWIFFormat',
            //         'senderBitcoinAddress',
            //         'receiverBitcoinAddress',
            //         0.001, // amount in BTC
            //         true   // use testnet
            //     );
                
            //     if (result.txid) {
            //         console.log('Transaction sent successfully:', result.txid);
            //     } else {
            //         console.error('Transaction failed:', result.error, result.details);
            //     }
            // }
            try {
                // validate required fields
                const requiredFields = ['transaction_amount', 'transaction_crypto_id', 'transaction_to_wallet_address'];
                for (const field of requiredFields) {
                    if (!req.body[field]) {
                        return res.status(400).json({
                            success: false, 
                            error: `Missing required field: ${field}`
                        });
                    }
                }
                let result;
                const userId = req.userData.user_id;
                // const transactionId = uuidv4();
                const transactionStatus = 1;
                const cryptoSymbol = req.body.transaction_crypto_symbol
                const transactionAmount = req.body.transaction_amount;
                const senderWalletAddress = req.body.transaction_from_wallet_address
                const receiverWalletAddress = req.body.transaction_to_wallet_address
                if (cryptoSymbol === 'BTC') {
                    result = await sendCrypto(
                        '8918b63eeb0522002a4eb7c693ae9e93fa3b28d129e32ef7f460c62e02f6f982', // privateKeyInWIFFormat',
                        senderWalletAddress,
                        receiverWalletAddress,
                        transactionAmount, // amount in BTC
                        true   // use testnet
                    );
                    
                    if (result.txid) {
                        console.log('Transaction sent successfully:', result.txid);
                        console.log('result:', result);
                    } else {
                        console.error('Transaction failed:', result.error, result.details);
                        res.status(422).json({
                            success: false,
                            message: "Transaction failed", 
                            result: result.error,
                            details: result.details
                        });
                    }
                }

                if (result && result.txid) {
                    const transaction = await Transaction.create({
                        transaction_id: result.txid, // transactionId, 
                        transaction_by: userId, 
                        transaction_amount: transactionAmount, 
                        transaction_crypto_id: req.body.transaction_crypto_id, 
                        transaction_crypto_symbol: cryptoSymbol, 
                        transaction_crypto_name: req.body.transaction_crypto_name, 
                        transaction_crypto_price: req.body.transaction_crypto_price, 
                        transaction_from_wallet_address: senderWalletAddress,
                        transaction_to_wallet_address: receiverWalletAddress, 
                        transaction_message: req.body.transaction_message || null, 
                        transaction_status: transactionStatus
                    });
                    
                    res.status(201).json({
                        success: true,
                        method: "create", 
                        transaction: transaction
                    });
                }
            } catch(err) {
                console.error("Transaction creation error:", err);
                res.status(422).json({
                    success: false,
                    error: err.message || "An error occurred during transaction creation"
                });
            }
        }
    }

    // Get wallet balance
    getWalletBalance = () => {
        return async (req, res, next) => {
            try {
                const walletAddress = req.params.address;
                const isTestnet = req.query.testnet !== 'false'; // Default to testnet=true
                
                if (!walletAddress) {
                    return res.status(400).json({
                        success: false,
                        error: "Wallet address is required"
                    });
                }
                
                // Validate Bitcoin address format
                try {
                    // This will throw an error if the address is invalid
                    new bitcore.Address(walletAddress);
                } catch (error) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid Bitcoin address format"
                    });
                }
                
                // Set network-specific variables
                const networkBaseUrl = isTestnet 
                    ? "https://blockstream.info/testnet/api" 
                    : "https://blockstream.info/api";
                
                // Get UTXOs for the address
                const utxoResponse = await axios({
                    method: "GET",
                    url: `${networkBaseUrl}/address/${walletAddress}/utxo`,
                    timeout: 5000
                });
                
                const utxos = utxoResponse.data || [];
                
                // Calculate total balance from UTXOs
                let totalBalance = 0;
                for (const utxo of utxos) {
                    totalBalance += utxo.value;
                }
                
                // Convert satoshis to BTC for easier reading
                const balanceBTC = totalBalance / 100000000;
                
                // Get transaction history (optional)
                const txHistoryResponse = await axios({
                    method: "GET",
                    url: `${networkBaseUrl}/address/${walletAddress}/txs`,
                    timeout: 5000
                }).catch(error => {
                    console.warn("Could not fetch transaction history:", error.message);
                    return { data: [] };
                });
                
                const txHistory = txHistoryResponse.data || [];
                
                // Process transaction history to get recent transactions
                const recentTransactions = txHistory.slice(0, 5).map(tx => {
                    return {
                        txid: tx.txid,
                        confirmed: tx.status.confirmed,
                        timestamp: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : null,
                        fee: tx.fee || 0
                    };
                });
                
                // Format the response
                res.status(200).json({
                    success: true,
                    method: "getWalletBalance", 
                    data: {
                        address: walletAddress,
                        network: isTestnet ? 'testnet' : 'mainnet',
                        balance: {
                            satoshis: totalBalance,
                            btc: balanceBTC.toFixed(8)
                        },
                        utxos: {
                            count: utxos.length,
                            details: utxos.map(utxo => ({
                                txid: utxo.txid,
                                vout: utxo.vout,
                                value: utxo.value,
                                status: utxo.status
                            }))
                        },
                        recentTransactions: recentTransactions,
                        transactionCount: txHistory.length
                    }
                });
            } catch(err) {
                console.error("Wallet balance error:", err);
                res.status(422).json({
                    success: false,
                    error: err.message || "An error occurred while fetching wallet balance"
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

module.exports = new TransactionsController()