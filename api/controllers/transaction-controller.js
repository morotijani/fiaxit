const Transaction = require("../models/transaction-model");
const Wallet = require("../models/wallet-model");
const Coin = require("../models/coin-model");
const User = require("../models/user-model");
const { Op } = require('sequelize'); // Import the Op object
const { v4: uuidv4 } = require('uuid')
const BitcoinWalletService = require('../service/bitcoin-wallet-service');
const EthereumWalletService = require('../service/ethereum-wallet-service');
const { decrypt } = require('../helpers/encryption');
const NotificationController = require('./notification-controller');
const emailHelper = require('../helpers/email-helper');

class TransactionsController {

    // get all transactions
    getAll = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id;
                const limit = parseInt(req.query.limit) || 50; // default limit to 50
                const offset = parseInt(req.query.offset) || 0; // default offset to 0
                const { count, rows } = await Transaction.findAndCountAll({
                    where: {
                        // only get transactions of the logged in user
                        // either sent or received by the user
                        [Op.or]: [
                            { transaction_by: userId },
                            { transaction_to: userId }
                        ]
                    },
                    order: [['createdAt', 'DESC']],
                    limit: limit,
                    offset: offset
                });
                res.status(200).json({
                    success: true,
                    method: "getAllTransactions",
                    data: rows,
                    total: count
                })
            } catch (err) {
                res.status(422).json({
                    success: false,
                    method: "getAllTransactions",
                    message: "An error occurred, please try again.",
                    details: err.error
                })
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
                data: {
                    transaction: null
                }
            }
            if (transaction) {
                resp.success = true;
                resp.method = "findById";
                resp.msg = "Transaction found!";
                resp.data = {
                    transaction: transaction
                }
            }
            res.status(200).json(resp)
        }
    }

    // create and make a trade
    create = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id;
                const transactionId = uuidv4();
                let transactionStatus = 'Pending';
                const cryptoSymbol = req.body.crypto_symbol
                const amount = req.body.amount;
                const receiverWalletAddress = req.body.toAddress
                const feeRate = req.body.feeRate || 10 // 0.0001 (if rate fee is not set)
                const walletId = req.body.crypto_id;

                // validate required fields
                const requiredFields = ['amount', 'crypto_symbol', 'toAddress', 'crypto_id'];
                for (const field of requiredFields) {
                    if (!req.body[field]) {
                        return res.status(400).json({
                            success: false,
                            method: "createAndSend" + cryptoSymbol,
                            path: field,
                            error: `Missing required field: ${field}`
                        });
                    }
                }

                // 1. Lookup the sender's wallet to get the private key safely
                const senderWallet = await Wallet.findOne({
                    where: {
                        wallet_id: walletId,
                        wallet_for: userId
                    }
                });

                if (!senderWallet) {
                    return res.status(404).json({
                        success: false,
                        method: "createAndSend" + cryptoSymbol,
                        error: "Sender wallet not found or unauthorized."
                    });
                }

                // 2. Decrypt the private key internally
                const senderPrivateKey = decrypt(senderWallet.wallet_privatekey);
                if (!senderPrivateKey) {
                    return res.status(500).json({
                        success: false,
                        method: "createAndSend" + cryptoSymbol,
                        error: "Failed to retrieve wallet keys."
                    });
                }

                // 3. Determine network settings dynamically
                const coin = await Coin.findOne({ where: { coin_symbol: cryptoSymbol.toUpperCase() } });
                const isTestnet = coin ? (coin.coin_network !== 'mainnet') : (process.env.NODE_ENV !== 'production');

                let result;
                if (cryptoSymbol === 'BTC') {
                    result = await BitcoinWalletService.sendCrypto(
                        senderPrivateKey,
                        receiverWalletAddress,
                        amount,
                        feeRate,
                        isTestnet
                    );

                    if (result.txid) {
                        console.log('Bitcoin Transaction sent successfully:', result.txid);
                    } else {
                        console.error('Transaction failed:', result.error, result.details);
                        res.status(422).json({
                            success: false,
                            method: "createAndSend" + cryptoSymbol,
                            message: "Bitcoin Transaction failed",
                            result: result.error,
                            details: result.details
                        });
                    }
                } else if (cryptoSymbol === 'USDT') {

                } else if (cryptoSymbol === 'ETH') {
                    const speedTransaction = null;
                    if (speedTransaction) {
                        const higherFee = 1.5 // 50% higher fee
                        // First get the nonce of the pending transaction
                        const pendingNonce = 42; // You need to know this value

                        // Then speed it up with a 50% higher fee
                        result = await EthereumWalletService.speedUpTransaction(
                            senderPrivateKey,
                            pendingNonce,
                            receiverWalletAddress,
                            amount,
                            higherFee
                        );
                    } else {
                        // use normal legacy transaction speed
                        result = await EthereumWalletService.sendEther(senderPrivateKey, receiverWalletAddress, amount)
                    }

                    if (result.txid) {
                        console.log('Ethereum Transaction send successfully:', result.txid)
                        console.log('result:', result)
                    } else {
                        console.error('Transaction failed:', result.error, result.details);
                        res.status(422).json({
                            success: false,
                            method: "createAndSend" + cryptoSymbol,
                            message: "Ethereum Transaction failed",
                            result: result.error,
                            details: result.details
                        });
                    }
                }

                // get transaction to id and save to db
                let to_id = null;
                try {
                    const toWallet = await Wallet.findOne({
                        where: {
                            wallet_address: receiverWalletAddress
                        }
                    });
                    if (toWallet) {
                        to_id = toWallet.wallet_for;
                        console.log("Receiver wallet found in our system:", toWallet.wallet_address);
                    } else {
                        console.log("Receiver wallet not found in our system:", receiverWalletAddress);
                    }
                } catch (err) {
                    console.error("Error finding receiver wallet:", err);
                }

                let transactionType = 'send';
                if (to_id === userId) {
                    transactionType = 'receive';
                }

                // save transaction to db
                if (result && result.txid) {
                    transactionStatus = 'Completed';
                    const transaction = await Transaction.create({
                        transaction_id: transactionId,
                        transaction_hash_id: result.txid,
                        transaction_by: userId,
                        transaction_to: to_id,
                        transaction_amount: amount,
                        transaction_type: transactionType,
                        transaction_crypto_id: req.body.crypto_id,
                        transaction_crypto_symbol: cryptoSymbol,
                        transaction_crypto_name: req.body.crypto_name,
                        transaction_crypto_price: req.body.crypto_price,
                        transaction_from_wallet_address: result.senderWalletAddress,
                        transaction_to_wallet_address: receiverWalletAddress,
                        transaction_message: req.body.note || null,
                        transaction_status: transactionStatus
                    });

                    // 4. Create Notification for Sender
                    await NotificationController.createNotification(
                        userId,
                        'Transaction Sent',
                        `Successfully sent ${amount} ${cryptoSymbol} to ${receiverWalletAddress.substring(0, 10)}...`,
                        'success',
                        transactionId,
                        'transaction',
                        `/transactions`
                    );

                    // 5. Create Notification for Receiver (if they are a user in our system)
                    if (to_id) {
                        await NotificationController.createNotification(
                            to_id,
                            'Transaction Received',
                            `Received ${amount} ${cryptoSymbol} from ${result.senderWalletAddress.substring(0, 10)}...`,
                            'info',
                            transactionId,
                            'transaction',
                            `/transactions`
                        );
                    }

                    // 6. Send Email Notifications (Async, don't await so we don't block response)
                    (async () => {
                        try {
                            // Sender Email
                            const sender = await User.findOne({ where: { user_id: userId } });
                            if (sender && sender.user_email) {
                                await emailHelper.sendMail({
                                    to: sender.user_email,
                                    subject: `Transaction Sent: ${amount} ${cryptoSymbol}`,
                                    html: emailHelper.getTransactionTemplate(
                                        sender.user_fname,
                                        amount,
                                        cryptoSymbol,
                                        'send',
                                        receiverWalletAddress,
                                        result.txid
                                    )
                                });
                            }

                            // Receiver Email (if internal)
                            if (to_id) {
                                const receiver = await User.findOne({ where: { user_id: to_id } });
                                if (receiver && receiver.user_email) {
                                    await emailHelper.sendMail({
                                        to: receiver.user_email,
                                        subject: `Transaction Received: ${amount} ${cryptoSymbol}`,
                                        html: emailHelper.getTransactionTemplate(
                                            receiver.user_fname,
                                            amount,
                                            cryptoSymbol,
                                            'receive',
                                            result.senderWalletAddress,
                                            result.txid
                                        )
                                    });
                                }
                            }
                        } catch (emailErr) {
                            console.error('[TransactionsController] Email notification failed:', emailErr);
                        }
                    })();

                    res.status(201).json({
                        success: true,
                        method: "createAndSend" + cryptoSymbol,
                        transaction: transaction,
                        data: {
                            transaction: result
                        }
                    });
                }
            } catch (error) {
                console.error("Transaction creation error:", error);
                res.status(422).json({
                    success: false,
                    error: "An error occurred during transaction creation",
                    details: error.message
                });
            }
        }
    }

    // update transaction
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
                        method: "updateTransaction",
                        message: "No valid fields provided for update."
                    });
                }

                // Update within transaction context
                await transaction.update(updateFields, { transaction: dbTransaction });

                // Commit the transaction
                await dbTransaction.commit();

                res.status(200).json({
                    success: true,
                    method: "updateTransaction",
                    message: "Transaction updated successfully.",
                    data: {
                        transaction: transaction
                    }
                });
            } catch (error) {
                // Rollback on error
                await dbTransaction.rollback();
                console.error("Transaction update error:", error);
                res.status(422).json({
                    success: false,
                    method: "updateTransaction",
                    error: "An error occurred during transaction update.",
                    details: error.message
                });
            }
        }
    }


    // delete transaction
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
                    resp.method = "deleteTransaction";
                    resp.message = "Transaction deleted successfully.";
                }
                res.status(200).json(resp)
            } catch (error) {
                console.error("Transaction deletion error:", err);
                res.status(422).json({
                    success: false,
                    method: "deleteTransaction",
                    error: "An error occurred during transaction deletion",
                    details: error.message
                });
            }
        }
    }
}

module.exports = new TransactionsController()