const Transaction = require("../models/transaction-model");
const { v4: uuidv4 } = require('uuid')
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