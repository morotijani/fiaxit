const axios = require("axios")
const bitcore = require("bitcore-lib")

class BitcoinWalletService {

	/**
	* Send Bitcoin from one address to another
	* @param {string} senderPrivateKey - Private key of the sender (WIF format)
	* @param {string} senderAddress - Bitcoin address of the sender
	* @param {string} receiverAddress - Bitcoin address of the recipient
	* @param {number} amountToSend - Amount to send in BTC
	* @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
	* @returns {Promise<{txid: string} | {error: string, details: any}>}
	*/
	async sendCrypto(
		senderPrivateKey,
		senderAddress,
		receiverAddress, 
		amountToSend,
		isTestnet = true
	) {
		try {
			// Validate inputs
			if (!senderPrivateKey || !senderAddress || !receiverAddress || !amountToSend) {
				throw new Error("Missing required parameters");
			}
			
			// Convert BTC to satoshis
			const satoshiToSend = Math.round(amountToSend * 100000000);
			if (satoshiToSend <= 0) {
				throw new Error("Amount must be greater than 0");
			}
			
			// Set network-specific variables
			const networkBaseUrl = isTestnet 
				? "https://blockstream.info/testnet/api" 
				: "https://blockstream.info/api";
			
			// Get UTXOs for the address
			const utxoResponse = await axios({
				method: "GET",
				url: `${networkBaseUrl}/address/${senderAddress}/utxo`,
				timeout: 5000 // Add timeout for API calls
			});
			
			if (!utxoResponse.data || utxoResponse.data.length === 0) {
				throw new Error("No UTXOs found for this address");
			}
			
			const utxos = utxoResponse.data;
			let totalAmountAvailable = 0;
			let inputs = [];
			
			// Process UTXOs 
			// (UTXOs are the unspent output in transactions ( UTXO represents a certain amount of cryptocurrency that has been authorized by a sender and is available to be spent by a recipient.))
			// getting balance on address
			for (const utxo of utxos) {
				inputs.push({
					satoshis: utxo.value,
					script: bitcore.Script.buildPublicKeyHashOut(senderAddress).toHex(),
					address: senderAddress,
					txId: utxo.txid,
					outputIndex: utxo.vout
				});
				totalAmountAvailable += utxo.value;
			}
			
			// Calculate fee
			const inputCount = inputs.length;
			const outputCount = 2; // Recipient + change address
			const transactionSize = inputCount * 180 + outputCount * 34 + 10 - inputCount;
			
			// Get fee rate - use fixed rate for testnet, dynamic for mainnet
			let feeRate;
			if (isTestnet) {
				feeRate = 1; // 1 sat/byte for testnet
			} else {
				try {
					const feeResponse = await axios.get(
					"https://bitcoinfees.earn.com/api/v1/fees/recommended",
					{ timeout: 5000 }
					);
					feeRate = feeResponse.data.hourFee;
				} catch (error) {
					// Fallback fee if API fails
					feeRate = 5; // 5 sat/byte as fallback
					console.warn("Fee estimation API failed, using fallback fee rate:", error.message);
				}
			}
			
			const fee = Math.ceil(transactionSize * feeRate);
			
			// Check if we have enough funds
			if (totalAmountAvailable - satoshiToSend - fee < 0) {
				throw new Error(`Insufficient balance. Available: ${totalAmountAvailable/100000000} BTC, Required: ${(satoshiToSend + fee)/100000000} BTC`);
			}
			
			// Create and sign transaction
			const transaction = new bitcore.Transaction()
				.from(inputs)
				.to(receiverAddress, satoshiToSend)
				.change(senderAddress)
				.fee(fee)
				.sign(senderPrivateKey);
			
			// Verify transaction is valid
			const isValid = transaction.isFullySigned();
			if (!isValid) {
				throw new Error("Transaction failed validation");
			}
			
			// Serialize and broadcast transaction 
			// (send the transaction to the blockchIN)
			const serializedTransaction = transaction.serialize();
			
			const broadcastResponse = await axios({
				method: "POST",
				url: `${networkBaseUrl}/tx`,
				data: serializedTransaction,
				timeout: 10000
			});
			
			return { txid: broadcastResponse.data };
			
		} catch (error) {
			console.error("Bitcoin transaction error:", error.message);
			return {
				error: "Failed to send Bitcoin transaction",
				details: error.message
			};
		}
	};
	
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
                        }
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

    // Get bitcoin wallet info
    getWalletInfo = () => {
        return async (req, res) => {
            try {
                const address = req.params.address;
                const isTestnet = req.query.testnet !== 'false'; // Default to testnet=true
                
                if (!address) {
                    return res.status(400).json({
                        success: false,
                        error: "Address parameter is required"
                    });
                }
                
                // Validate Bitcoin address format
                try {
                    // This will throw an error if the address is invalid
                    new bitcore.Address(address);
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
                    url: `${networkBaseUrl}/address/${address}/utxo`,
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
                    url: `${networkBaseUrl}/address/${address}/txs`,
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
                    method: "getWalletInfo", 
                    data: {
                        address: address,
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
            } catch (error) {
                console.error("Wallet info error:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get wallet information",
                    details: error.message
                });
            }
        }
    }

}

module.exports = new BitcoinWalletService() // instantiate class and add to module so that we can use it anywhere else