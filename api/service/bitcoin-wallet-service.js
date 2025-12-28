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
		this.network = (process.env.NODE_ENV === 'production' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet);

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
	generateWallet() {
		try {
			const isTestnet = (process.env.NODE_ENV === 'production' ? false : true);

			// Set network based on isTestnet
			this.network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
			console.log('[BTC Service] Generating mnemonic...');

			// Generate a random mnemonic (seed phrase)
			const mnemonic = bip39.generateMnemonic();

			// Convert mnemonic to seed
			const seed = bip39.mnemonicToSeedSync(mnemonic);
			console.log('[BTC Service] Creating root node from seed...');

			// Create a root node from the seed
			const root = bip32.fromSeed(seed, this.network);

			// Derive the first account's node (m/44'/0'/0'/0/0)
			const path = isTestnet ? "m/44'/1'/0'/0/0" : "m/44'/0'/0'/0/0";
			console.log('[BTC Service] Deriving path:', path);
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
			console.error("Error generating Bitcoin wallet. Check step logs above.");
			throw new Error(`Failed to generate Bitcoin wallet: ${error.message}`);
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
				throw new Error("Missing required parameters.");
			}

			// Validate private key format
			if (!senderPrivateKey || typeof senderPrivateKey !== 'string') {
				throw new Error("Invalid private key: must be a non-empty string.");
			}

			// Validate recipient address
			if (!this.isValidBitcoinAddress(receiverAddress, isTestnet)) {
				throw new Error("Invalid recipient Bitcoin address.");
			}

			// Convert BTC to satoshis
			const satoshiToSend = Math.round(amountToSend * 100000000);
			if (satoshiToSend <= 0) {
				throw new Error("Amount must be greater than 0.");
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
				throw new Error(`Insufficient balance. Available: ${totalAmountAvailable / 100000000} BTC, Required: ${(satoshiToSend + fee) / 100000000} BTC, Fee: ${fee / 100000000} BTC.`);
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
				throw new Error("Transaction failed validation.");
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
				error: "Failed to send Bitcoin transaction.",
				details: error.message
			};
		}
	};

	/**
	   * Get Bitcoin wallet balance
	*/
	getWalletBalance = (addressParam, isTestnetParam) => {
		return async (req, res, next) => {
			try {
				const address = addressParam || req.params.address;
				const isTestnet = isTestnetParam !== undefined ? isTestnetParam : (process.env.NODE_ENV === 'production' ? false : true);
				const networkBaseUrl = isTestnet ? "https://blockstream.info/testnet/api" : "https://blockstream.info/api";

				const response = await axios.get(`${networkBaseUrl}/address/${address}`, { timeout: 7000 });
				const data = response.data || {};
				const chainStats = data.chain_stats || {};
				const mempoolStats = data.mempool_stats || {};

				const confirmed = (chainStats.funded_txo_sum || 0) - (chainStats.spent_txo_sum || 0);
				const unconfirmed = (mempoolStats.funded_txo_sum || 0) - (mempoolStats.spent_txo_sum || 0);
				const total = confirmed + unconfirmed;

				const result = {
					address,
					network: isTestnet ? 'testnet' : 'mainnet',
					balance: {
						confirmed: confirmed / 100000000,
						unconfirmed: unconfirmed / 100000000,
						total: (total / 100000000).toFixed(8),
						satoshis: total
					}
				};

				if (res) return res.status(200).json({ success: true, data: result });
				return result;
			} catch (error) {
				if (res) return res.status(500).json({ success: false, error: error.message });
				throw error;
			}
		}
	}

	/**
	   * Get Bitcoin wallet information including transactions
	*/
	getWalletInfo = (addressParam, isTestnetParam) => {
		return async (req, res, next) => {
			try {
				const address = addressParam || req.params.address;
				const isTestnet = isTestnetParam !== undefined ? isTestnetParam : (process.env.NODE_ENV === 'production' ? false : true);
				const networkBaseUrl = isTestnet ? "https://blockstream.info/testnet/api" : "https://blockstream.info/api";

				const [addrResp, txsResp] = await Promise.all([
					axios.get(`${networkBaseUrl}/address/${address}`, { timeout: 7000 }),
					axios.get(`${networkBaseUrl}/address/${address}/txs`, { timeout: 7000 })
				]);

				const addrData = addrResp.data || {};
				const chainStats = addrData.chain_stats || {};
				const mempoolStats = addrData.mempool_stats || {};

				const confirmed = (chainStats.funded_txo_sum || 0) - (chainStats.spent_txo_sum || 0);
				const unconfirmed = (mempoolStats.funded_txo_sum || 0) - (mempoolStats.spent_txo_sum || 0);
				const total = confirmed + unconfirmed;

				const txsData = Array.isArray(txsResp.data) ? txsResp.data : [];
				const transactions = txsData.map(tx => {
					let type = 'sent';
					let amountSat = 0;

					const addressOutputs = tx.vout.filter(out => out.scriptpubkey_address === address);
					const isOutput = addressOutputs.length > 0;
					const isInput = tx.vin.some(vin => vin.prevout && vin.prevout.scriptpubkey_address === address);

					if (isInput && isOutput) {
						type = 'self';
						amountSat = tx.vout.reduce((sum, out) => out.scriptpubkey_address !== address ? sum + (out.value || 0) : sum, 0);
					} else if (isInput) {
						type = 'sent';
						amountSat = tx.vout.reduce((sum, out) => out.scriptpubkey_address !== address ? sum + (out.value || 0) : sum, 0);
					} else {
						type = 'received';
						amountSat = addressOutputs.reduce((sum, out) => sum + (out.value || 0), 0);
					}

					return {
						txid: tx.txid,
						type,
						amount: amountSat / 100000000,
						confirmations: tx.status && tx.status.confirmed ? 1 : 0,
						timestamp: tx.status && tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : new Date().toISOString()
					};
				});

				const result = {
					address,
					network: isTestnet ? 'testnet' : 'mainnet',
					balance: {
						confirmed: confirmed / 100000000,
						unconfirmed: unconfirmed / 100000000,
						total: total / 100000000
					},
					transactions,
					txCount: (chainStats.tx_count || 0) + (mempoolStats.tx_count || 0),
					totalReceived: (chainStats.funded_txo_sum || 0) / 100000000,
					totalSent: (chainStats.spent_txo_sum || 0) / 100000000
				};

				if (res) return res.status(200).json({ success: true, data: result });
				return result;
			} catch (error) {
				if (res) return res.status(422).json({ success: false, error: error.message });
				throw error;
			}
		}
	}

	isValidBitcoinAddress(address, isTestnet) {
		try {
			const network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
			bitcoin.address.toOutputScript(address, network);
			return true;
		} catch (error) {
			return false;
		}
	}

}

module.exports = new BitcoinWalletService()