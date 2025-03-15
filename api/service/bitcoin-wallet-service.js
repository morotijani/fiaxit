const axios = require("axios")
const bitcore = require("bitcore-lib")
const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const bip39 = require('bip39');
const { ECPairFactory } = require('ecpair');

// Initialize BIP32 with the required elliptic curve implementation
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

class BitcoinWalletService {
	constructor() {
		// Default to testnet, can be changed to bitcoin.networks.bitcoin for mainnet
		this.network = bitcoin.networks.testnet;
		
		// BlockCypher API endpoints
		this.apiEndpoints = {
			mainnet: 'https://api.blockcypher.com/v1/btc/main',
			testnet: 'https://api.blockcypher.com/v1/btc/test3'
		};
	}

	/**
	   * Generate a new Bitcoin wallet
	   * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
	   * @returns {Object} Wallet information including address and private key
	*/
	generateWallet(isTestnet = true) {
		try {
			// Set network based on isTestnet parameter
			this.network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
			
			// Generate a random mnemonic (seed phrase)
			const mnemonic = bip39.generateMnemonic();
			
			// Convert mnemonic to seed
			const seed = bip39.mnemonicToSeedSync(mnemonic);
			
			// Create a root node from the seed
			const root = bip32.fromSeed(seed, this.network);
		  
			// Derive the first account's node (m/44'/0'/0'/0/0)
			const path = isTestnet ? "m/44'/1'/0'/0/0" : "m/44'/0'/0'/0/0";
			const child = root.derivePath(path);
			
			// Get the private key in WIF format
			const privateKey = child.toWIF();
			
			// Create an ECPair from the child node's private key
			const keyPair = ECPair.fromPrivateKey(child.privateKey, { network: this.network });
		  
			// Get the public key and create a P2PKH address
			const { address } = bitcoin.payments.p2pkh({
				pubkey: keyPair.publicKey,
				network: this.network
		  	});
		  
			return {
				address,
				privateKey,
				mnemonic,
				network: isTestnet ? 'testnet' : 'mainnet'
			};
		} catch (error) {
		  	console.error("Error generating Bitcoin wallet:", error);
		  	throw new Error(`Failed to generate wallet: ${error.message}`);
		}
	}

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
		receiverAddress, 
		amountToSend,
		isTestnet
	) {
		try {
			// Validate inputs
			if (!senderPrivateKey || !receiverAddress || !amountToSend) {
				throw new Error("Missing required parameters");
			}

			// Validate private key format
			if (!senderPrivateKey || typeof senderPrivateKey !== 'string') {
				throw new Error("Invalid private key: must be a non-empty string");
			}

			// Validate recipient address
			if (!this.isValidBitcoinAddress(receiverAddress, isTestnet)) {
				throw new Error("Invalid recipient Bitcoin address");
			}
			
			// Convert BTC to satoshis
			const satoshiToSend = Math.round(amountToSend * 100000000);
			if (satoshiToSend <= 0) {
				throw new Error("Amount must be greater than 0");
			}

			// Import the private key with proper error handling
			let keyPair;
			try {
			  	keyPair = ECPair.fromWIF(senderPrivateKey, this.network);
			} catch (error) {
			  	throw new Error(`Invalid private key: ${error.message}`);
			}

			// Get the sender's address
			const { address: fromAddress } = bitcoin.payments.p2pkh({
				pubkey: keyPair.publicKey,
				network: this.network
			});
			
			console.log(`Sending from address: ${fromAddress}`);

			// Set network-specific variables
			const networkBaseUrl = isTestnet 
				? "https://blockstream.info/testnet/api" 
				: "https://blockstream.info/api";
			
			// Get UTXOs for the address
			const utxoResponse = await axios({
				method: "GET",
				url: `${networkBaseUrl}/address/${fromAddress}/utxo`,
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
					script: bitcore.Script.buildPublicKeyHashOut(fromAddress).toHex(),
					address: fromAddress,
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
				throw new Error(`Insufficient balance. Available: ${totalAmountAvailable/100000000} BTC, Required: ${(satoshiToSend + fee)/100000000} BTC, Fee: ${fee/100000000} BTC`);
			}
			
			// Create and sign transaction
			const transaction = new bitcore.Transaction()
				.from(inputs)
				.to(receiverAddress, satoshiToSend)
				.change(fromAddress)
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
			
			return { 
				txid: broadcastResponse.data, 
				senderWalletAddress: fromAddress 
			};
			
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
                    method: "getBitcoinWalletBalance", 
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
                res.status(500).json({
                    success: false,
                    error: err.message || "An error occurred while fetching wallet balance"
                });
            }
        }
    }

	/**
	   * Get Bitcoin wallet information
	   * @param {string} address - Bitcoin address
	   * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
	   * @returns {Promise<Object>} Wallet information
	*/

	getWalletInfo = () => {
		return async (req, res, next) => {
			try {
				const address = req.params.address;
				const isTestnet = req.query.testnet !== 'false'; // Default to testnet=true
				if (!address) {
					return res.status(400).json({
						success: false,
						error: "Wallet address is required"
					});
				}

				// Validate Bitcoin address
				if (!this.isValidBitcoinAddress(address, isTestnet)) {
					throw new Error("Invalid Bitcoin address");
				}
				
				const network = isTestnet ? 'testnet' : 'mainnet';
				const apiUrl = `${this.apiEndpoints[network]}/addrs/${address}`;
				
				// Fetch address information from BlockCypher API
				const response = await axios.get(apiUrl);
				const data = response.data;
				
				// Fetch recent transactions
				const txsUrl = `${apiUrl}/full?limit=10`;
				const txsResponse = await axios.get(txsUrl);
				const txsData = txsResponse.data;
				
				// Format transactions
				const transactions = txsData.txs ? txsData.txs.map(tx => {
					// Calculate if this transaction is sending or receiving for this address
					let type = 'unknown';
					let amount = 0;
					
					// Check inputs (sending)
					const isInput = tx.inputs.some(input => 
						input.addresses && input.addresses.includes(address)
					);
					
					// Check outputs (receiving)
					const isOutput = tx.outputs.some(output => 
						output.addresses && output.addresses.includes(address)
					);
					
					if (isInput && isOutput) {
						type = 'self';
						
						// Calculate the change amount
						const totalOut = tx.outputs.reduce((sum, output) => {
							if (output.addresses && !output.addresses.includes(address)) {
							return sum + output.value;
							}
							return sum;
						}, 0);
						
						amount = -totalOut;
					} else if (isInput) {
						type = 'sent';
						
						// Calculate the sent amount (excluding change)
						const totalOut = tx.outputs.reduce((sum, output) => {
							if (output.addresses && !output.addresses.includes(address)) {
								return sum + output.value;
							}
								return sum;
						}, 0);
						
						amount = -totalOut;
					} else if (isOutput) {
						type = 'received';
						
						// Calculate the received amount
						amount = tx.outputs.reduce((sum, output) => {
							if (output.addresses && output.addresses.includes(address)) {
								return sum + output.value;
							}
							return sum;
						}, 0);
					}
					
					return {
						txid: tx.hash,
						type,
						amount: amount / 100000000, // Convert satoshis to BTC
						fee: tx.fees / 100000000,
						confirmations: tx.confirmations || 0,
						blockHeight: tx.block_height || null,
						timestamp: tx.received ? new Date(tx.received).toISOString() : null,
						inputs: tx.inputs.map(input => ({
							addresses: input.addresses || [],
							value: input.output_value ? input.output_value / 100000000 : 0
						})),
						outputs: tx.outputs.map(output => ({
							addresses: output.addresses || [],
							value: output.value ? output.value / 100000000 : 0
						}))
					};
				}) : [];
				
				res.status(200).json({
					success: true, 
					address, 
					network, 
					balance: {
						confirmed: data.balance / 100000000, // Convert satoshis to BTC
						unconfirmed: data.unconfirmed_balance / 100000000, 
						total: (data.balance + data.unconfirmed_balance) / 100000000
					}, 
					transactions, 
					txCount: data.n_tx, 
					totalReceived: data.total_received / 100000000, 
					totalSent: data.total_sent / 100000000, 
					lastUpdated: new Date().toISOString()
				});
			} catch (error) {
				console.error("Error getting Bitcoin wallet info:", error);
				res.status(422).json({
					success: false,
					method: "getBitcoinWalletInfo", 
					error: "Failed to BTC get wallet info",
					details: error.message || "An error occurred while fetching wallet balance"
				});
			}
		}
	}

	/**
	   * Validate a Bitcoin address
	   * @param {string} address - Bitcoin address to validate
	   * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
	   * @returns {boolean} Whether the address is valid
	*/
	isValidBitcoinAddress(address, isTestnet = true) {
		try {
			const network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
		
			// Try to decode the address
			bitcoin.address.toOutputScript(address, network);
			return true;
		} catch (error) {
			return false;
		}
	}

}

module.exports = new BitcoinWalletService()