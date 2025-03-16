const ethers = require('ethers');
const axios = require('axios');

class EthereumWalletService {
	constructor() {
		// Initialize with a default network
		this.currentNetwork = (process.env.NODE_ENV === 'production' ? 'mainnet' : 'sepolia')
		
		// Your Alchemy API key
		const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
		
		// Define network configurations with your API key
		this.networks = {
			mainnet: {
				rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, 
				chainId: 1, 
				name: 'mainnet', 
				etherscanApi: 'https://api.etherscan.io/api'
			}, 
			sepolia: {
				rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, 
				chainId: 11155111, 
				name: 'sepolia', 
				etherscanApi: 'https://api-sepolia.etherscan.io/api' 
			},
			goerli: {
				rpcUrl: `https://eth-goerli.g.alchemy.com/v2/${ALCHEMY_API_KEY}`, 
				chainId: 5, 
				name: 'goerli', 
				etherscanApi: 'https://api-goerli.etherscan.io/api'
			}
		};
    
		// Add retry options to the provider
		this.providerOptions = {
			polling: true, 
			pollingInterval: 4000, // 4 seconds
			maxRetries: 5, 
			retryDelay: 1000, // 1 second
		};
		
		// Default API key - replace with your own
		this.etherscanApiKey = process.env.ETHERSCAN_API_KEY || '';
		
		// Initialize provider with explicit network configuration
		this.initializeProvider(this.currentNetwork);
	}

	/**
	 	* Initialize the JSON-RPC provider with explicit network configuration
	 	* @param {string} networkName - Network name
	*/
	initializeProvider(networkName) {
		const network = this.networks[networkName];
		if (!network) {
			throw new Error(`Unsupported network: ${networkName}.`);
		}
		
		try {
			// Create provider with explicit network configuration and retry options
			this.provider = new ethers.JsonRpcProvider(
				network.rpcUrl,
				{
					chainId: network.chainId,
					name: network.name,
					...this.providerOptions
				}
			);
			
			// Add error handling
			this.provider.on("error", (error) => {
				console.error("Provider error:", error);
			});
      
			this.currentNetwork = networkName;
		} catch (error) {
			console.error(`Failed to initialize provider for ${networkName}:`, error);
			throw new Error(`Provider initialization failed: ${error.message}.`);
		}
	}

	/**
	 	* Set the network provider
	 	* @param {string} network - Network name ('mainnet', 'sepolia', 'goerli', etc.)
	 	* @param {string} customRpcUrl - Optional custom RPC URL
	*/
	setNetwork(network = null, customRpcUrl = null) {
		try {
			if (customRpcUrl) {
				// If custom RPC URL is provided, use it with the network's chain ID
				const networkConfig = this.networks[network];
				if (!networkConfig) {
					throw new Error(`Unsupported network: ${network}.`);
				}
				
				this.provider = new ethers.JsonRpcProvider(
					customRpcUrl,
					{
						chainId: networkConfig.chainId, 
						name: networkConfig.name, 
						...this.providerOptions
					}
				);
						
				// Add error handling
				this.provider.on("error", (error) => {
					console.error("Provider error:", error);
				});
				
				this.currentNetwork = network;
				return;
			}
      
			// Otherwise use the predefined network
			this.initializeProvider(network);
		} catch (error) {
			console.error(`Failed to set network to ${network}:`, error);
			throw new Error(`Network change failed: ${error.message}.`);
		}
	}

	/**
	 	* Generate a new Ethereum wallet
	 	* @param {string} network - Optional network specification ('mainnet', 'sepolia', etc.)
	 	* @returns {Object} Wallet information including address and private key
	*/
  	generateWallet(network = null) {
		try {
			// Use specified network or current network
			const targetNetwork = network || this.currentNetwork;
			
			// Generate a random wallet
			const wallet = ethers.Wallet.createRandom();

			return {
				address: wallet.address, 
				privateKey: wallet.privateKey, 
				mnemonic: wallet.mnemonic.phrase, 
				path: wallet.mnemonic.path, 
				network: targetNetwork // Specify the intended network
			};
		} catch (error) {
			console.error("Error generating Ethereum wallet:", error);
			throw new Error(`Failed to generate wallet: ${error.message}.`);
		}
  	}

	/**
	 	* Get Ethereum wallet balance
	 	* @param {string} address - Ethereum address
	 	* @returns {Promise<Object>} Balance information
	*/
	getWalletBalance = () => {
		return async (req, res, next) => {
			try {
				const address = req.params.address;
			
				if (!address) {
					return res.status(400).json({
						success: false, 
						method: "getETHWalletBalance", 
						error: "Wallet address is required."
					});
				}

				if (!this.isValidEthereumAddress(address)) {
					return res.status(400).json({
						success: false, 
						method: "getETHWalletBalance", 
						error: "Invalid Ethereum address format."
					});
				}

				// Add retry logic
				let attempts = 0;
				const maxAttempts = 3;
				let lastError;
				
				while (attempts < maxAttempts) {
					try {
						const balanceWei = await this.provider.getBalance(address);
						const balanceEth = ethers.formatEther(balanceWei);

						res.status(200).json({
							success: true, 
							method: "getETHWalletBalance", 
							message: `Successfully viewed Ethereum wallet balance for ${address}`, 
							data: {
								address,
								balanceWei: balanceWei.toString(),
								balanceEth,
								network: this.currentNetwork
							}
						});
					} catch (error) {
						lastError = error;
						attempts++;
						if (attempts === maxAttempts) break;

						// Exponential backoff
						await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
					}
				}
		
				console.error("Ethereum Wallet balance error:", lastError);
				res.status(422).json({
					success: false, 
					method: "getETHWalletBalance", 
					error: lastError || "Failed to get balance after multiple attempts."
				});
			} catch (error) {
				console.error("Error getting Ethereum wallet balance:", error);
				res.status(500).json({
					success: false, 
					method: "getETHWalletBalance", 
					error: "An error occurred while fetching wallet balance.", 
					details: `Failed to get Ethereum wallet balance: ${error.message}`
				});
			}
		}
	}

  	/**
		* Get Ethereum wallet information including transactions
		* @param {string} address - Ethereum address
		* @returns {Promise<Object>} Wallet information
   	*/
	getWalletInfo = () => {
		return async (req, res) => {
			try {
				const address = req.params.address;
				
				if (!address) {
					return res.status(400).json({
						success: false, 
						method: "getETHWalletInfo", 
						error: "Wallet address is required."
					});
				}

				if (!this.isValidEthereumAddress(address)) {
					return res.status(400).json({
						success: false, 
						method: "getETHWalletInfo", 
						error: "Invalid Ethereum address."
					})
				}

				// Get current network
				const network = this.currentNetwork;
				const etherscanApi = this.networks[network].etherscanApi;

				// Get balance with retry logic
				let balanceInfo;
				try {
					balanceInfo = await this.getWalletBalance(address);
				} catch (error) {
					console.error("Error getting balance:", error);
					balanceInfo = { balanceWei: "0", balanceEth: "0" };
				}

				// Get transaction count (nonce) with retry
				let transactionCount = 0;
				try {
					transactionCount = await this.provider.getTransactionCount(address);
				} catch (error) {
					console.error("Error getting transaction count:", error);
				}

				// Get transactions from Etherscan API
				let transactions = [];
				try {
					if (this.etherscanApiKey) {
						const transactionsResponse = await axios.get(etherscanApi, {
							params: {
								module: 'account', 
								action: 'txlist', 
								address: address, 
								startblock: 0, 
								endblock: 99999999, 
								page: 1, 
								offset: 10, // Get last 10 transactions
								sort: 'desc', 
								apikey: this.etherscanApiKey
							}, 
							timeout: 5000 // 5 second timeout
						});

						// Format transactions
						if (transactionsResponse.data && transactionsResponse.data.status === '1') {
							transactions = transactionsResponse.data.result.map(tx => ({
								hash: tx.hash, 
								from: tx.from, 
								to: tx.to, 
								value: ethers.formatEther(tx.value), 
								gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei'), 
								gasUsed: tx.gasUsed, 
								blockNumber: tx.blockNumber, 
								timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(), 
								isError: tx.isError === '1', 
								confirmations: tx.confirmations
							}));
						}
					} else {
					console.warn("Etherscan API key not provided. Transaction history unavailable.");
					}
				} catch (error) {
					console.error("Error fetching transaction history:", error);
				}

				res.status(200).json({
					success: true, 
					method: "getETHWalletInfo", 
					message: `Successfully listed Ethereum wallet info for ${address}`, 
					data: {
						address, 
						network, 
						balance: {
							wei: balanceInfo.balanceWei, 
							ether: balanceInfo.balanceEth
						},
						transactionCount, 
						transactions, 
						lastUpdated: new Date().toISOString() 
					}
				});
			} catch (error) {
				console.error("Error getting Ethereum wallet info:", error);
				return {
					success: false, 
					method: "getETHWalletInfo", 
					error: "Failed to get Ethereum wallet info", 
					details: error.message
				};
			}
		}
  	}

  	/**
	 	* Send Ethereum from one address to another
	 	* @param {string} senderPrivateKey - Private key of the sender
	 	* @param {string|number} amountToSend - Amount to send in ETH
	 	* @param {string} receiverAddress - Ethereum address of the recipient
	 	* @param {Object} options - Optional transaction parameters
	 	* @returns {Promise<Object>} Transaction result
	*/
	async sendEther(senderPrivateKey, receiverAddress, amountToSend, options = {}) {
		try {
			// Validate inputs
			if (!senderPrivateKey || !receiverAddress || !amountToSend) {
				throw new Error("Missing required parameters");
			}
		
			// Validate receiver address
			if (!this.isValidEthereumAddress(receiverAddress)) {
				throw new Error("Invalid recipient Ethereum address");
			}
		
			// Create wallet instance from private key
			const wallet = new ethers.Wallet(senderPrivateKey, this.provider);
			const senderAddress = wallet.address;
		
			// Convert ETH to wei
			const amountWei = ethers.parseEther(amountToSend.toString());
		
			// Get sender's balance
			const balanceWei = await this.provider.getBalance(senderAddress);
		
			// Check if sender has enough balance
			if (balanceWei < amountWei) {
				throw new Error(`Insufficient balance. Available: ${ethers.formatEther(balanceWei)} ETH, Required: ${amountToSend} ETH.`);
			}

			// Get current gas price with retry logic
			let feeData;
			try {
				feeData = await this.provider.getFeeData();

				// Ensure fee data is valid
				if (!feeData) {
					throw new Error("Invalid fee data received from provider.");
				}
			} catch (error) {
				console.error("Error getting fee data:", error);
				// Fallback to reasonable defaults if fee data can't be fetched
				feeData = {
					maxFeePerGas: ethers.parseUnits("50", "gwei"), // Maximum amount you’re willing to pay (the maximum amount the sender is willing to pay for each unit of gas in the transaction)
					maxPriorityFeePerGas: ethers.parseUnits("1.5", "gwei"),  // Priority fee to include the transaction in the block (is a user-defined priority fee that the sender is willing to pay to ensure their transaction is included in a block quickly.)
					gasPrice: ethers.parseUnits("30", "gwei") // Add fallback for legacy transactions
				};
			}
  
			// Apply fee multiplier for replacement transactions if specified
			const feeMultiplier = options.feeMultiplier || 1.1; // Default 10% increase
			
			// Get the nonce - either use provided nonce or get the next one
			const nonce = options.nonce !== undefined ? options.nonce : await this.provider.getTransactionCount(senderAddress); // (number of transactions sent from the sender's address)
		
			// Create transaction object
			const tx = {
				to: receiverAddress, 
				value: amountWei, 
				gasLimit: options.gasLimit || 21000, // Standard gas limit for ETH transfer
				nonce: nonce // 
			};

			// Handle EIP-1559 vs legacy transactions
			if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
				// EIP-1559 transaction
				try {
				  	// Safe conversion to number with fallback
				  	let maxFeePerGasValue;
					try {
						maxFeePerGasValue = Number(feeData.maxFeePerGas);
					} catch (e) {
						maxFeePerGasValue = 0;
					}
					
					if (!isNaN(maxFeePerGasValue) && maxFeePerGasValue > 0) {
						tx.maxFeePerGas = options.maxFeePerGas || ethers.getBigInt(Math.floor(maxFeePerGasValue * feeMultiplier));
					} else {
						tx.maxFeePerGas = ethers.parseUnits("50", "gwei");
					}
					
					// Safe conversion to number with fallback
					let maxPriorityFeePerGasValue;
					try {
						maxPriorityFeePerGasValue = Number(feeData.maxPriorityFeePerGas);
					} catch (e) {
						maxPriorityFeePerGasValue = 0;
					}
					
					if (!isNaN(maxPriorityFeePerGasValue) && maxPriorityFeePerGasValue > 0) {
						tx.maxPriorityFeePerGas = options.maxPriorityFeePerGas || ethers.getBigInt(Math.floor(maxPriorityFeePerGasValue * feeMultiplier));
					} else {
						tx.maxPriorityFeePerGas = ethers.parseUnits("1.5", "gwei");
					}
				} catch (error) {
				  	console.error("Error calculating EIP-1559 fees:", error);
					// Fallback to fixed values
					tx.maxFeePerGas = ethers.parseUnits("50", "gwei");
					tx.maxPriorityFeePerGas = ethers.parseUnits("1.5", "gwei");
				}
			} else if (feeData.gasPrice) {
				// Legacy transaction
				try {
				  	// Safe conversion to number with fallback
				  	let gasPriceValue;
				  	try {
						gasPriceValue = Number(feeData.gasPrice);
					} catch (e) {
						gasPriceValue = 0;
					}
					
					if (!isNaN(gasPriceValue) && gasPriceValue > 0) {
						tx.gasPrice = options.gasPrice || ethers.getBigInt(Math.floor(gasPriceValue * feeMultiplier));
					} else {
						tx.gasPrice = ethers.parseUnits("30", "gwei");
					}
				} catch (error) {
				  	console.error("Error calculating legacy gas price:", error);
				  	tx.gasPrice = ethers.parseUnits("30", "gwei");
				}
			} else {
				// If all else fails, use a safe default
				tx.gasPrice = ethers.parseUnits("30", "gwei");
			}
	
			// Log transaction parameters for debugging
			console.log("Sending transaction with params:", {
				nonce: tx.nonce, 
				maxFeePerGas: tx.maxFeePerGas ? ethers.formatUnits(tx.maxFeePerGas, "gwei") : undefined, 
				maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.formatUnits(tx.maxPriorityFeePerGas, "gwei") : undefined, 
				gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, "gwei") : undefined, 
				gasLimit: tx.gasLimit, 
				value: ethers.formatEther(tx.value)
			});
	
			// Sign and send transaction
			const transaction = await wallet.sendTransaction(tx);
			console.log(`Transaction sent: ${transaction.hash}`);
		
			// Wait for transaction to be mined (if waitForConfirmation is true)
			if (options.waitForConfirmation !== false) {
				try {
				  	const receipt = await transaction.wait();
				  	console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
		  
					// Safely extract values with null checks
					const blockNumber = receipt.blockNumber ? receipt.blockNumber : null;
					const gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : "unknown";
					const effectiveGasPrice = receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : "unknown";
					const txHash = receipt.hash || transaction.hash;
		  
					return {
						success: true, 
						txid: txHash, 
						blockNumber: blockNumber, 
						senderWalletAddress: senderAddress, 
						to: receiverAddress, 
						amount: amountToSend, 
						gasUsed: gasUsed, 
						effectiveGasPrice: effectiveGasPrice,  
						network: this.currentNetwork
					};
				} catch (error) {
				  console.error("Error waiting for transaction confirmation:", error);
				  // Return partial success info since the transaction was sent but confirmation failed
				  	return {
						success: true, 
						txid: transaction.hash, 
						senderWalletAddress: senderAddress, 
						to: receiverAddress, 
						amount: amountToSend, 
						network: this.currentNetwork, 
						confirmationError: error.message, 
						pending: true
				  	};
				}
			} else {
				// Return immediately without waiting for confirmation
				return {
					success: true, 
					txid: transaction.hash, 
					senderWalletAddress: senderAddress, 
					to: receiverAddress, 
					amount: amountToSend, 
					nonce: tx.nonce, 
					network: this.currentNetwork, 
					pending: true
				};
			}
		} catch (error) {
			console.error("Ethereum transaction error:", error);
			return {
				success: false,
				error: "Failed to send Ethereum transaction.",
				details: error.message
			};
		}
	}
  
  	/**
	 	* Cancel a pending transaction
	 	* @param {string} senderPrivateKey - Private key of the sender
	 	* @param {number} nonce - Nonce of the transaction to cancel
	 	* @returns {Promise<Object>} Cancellation result
	*/
	async cancelTransaction(senderPrivateKey, nonce) {
		try {
			// Create wallet instance from private key
			const wallet = new ethers.Wallet(senderPrivateKey, this.provider);
			const senderAddress = wallet.address;
			
			// Get current fee data with safety checks
			let feeData;
			try {
				feeData = await this.provider.getFeeData();
				if (!feeData) {
					throw new Error("Invalid fee data received from provider.");
				}
			} catch (error) {
				console.error("Error getting fee data:", error);
				// Fallback to reasonable defaults
				feeData = {
					maxFeePerGas: ethers.parseUnits("50", "gwei"), 
					maxPriorityFeePerGas: ethers.parseUnits("1.5", "gwei"), 
					gasPrice: ethers.parseUnits("30", "gwei")
				};
			}
		
			// Create a transaction to self with 0 ETH but higher gas price
			const tx = {
				to: senderAddress, // Send to self
				value: 0, // 0 ETH
				gasLimit: 21000, 
				nonce: nonce
			};
		
			// Handle EIP-1559 vs legacy transactions with safety checks
			if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
				try {
					// Safe conversion with fallbacks
					let maxFeePerGasValue;
					try {
						maxFeePerGasValue = Number(feeData.maxFeePerGas);
					} catch (e) {
						maxFeePerGasValue = 0;
					}
					
					if (!isNaN(maxFeePerGasValue) && maxFeePerGasValue > 0) {
						tx.maxFeePerGas = ethers.getBigInt(Math.floor(maxFeePerGasValue * 1.5)); // 50% higher
					} else {
						tx.maxFeePerGas = ethers.parseUnits("75", "gwei"); // Higher default
					}
					
					let maxPriorityFeePerGasValue;
					try {
						maxPriorityFeePerGasValue = Number(feeData.maxPriorityFeePerGas);
					} catch (e) {
						maxPriorityFeePerGasValue = 0;
					}
					
					if (!isNaN(maxPriorityFeePerGasValue) && maxPriorityFeePerGasValue > 0) {
						tx.maxPriorityFeePerGas = ethers.getBigInt(Math.floor(maxPriorityFeePerGasValue * 1.5)); // 50% higher
					} else {
						tx.maxPriorityFeePerGas = ethers.parseUnits("2", "gwei"); // Higher default
					}
				} catch (error) {
					console.error("Error calculating EIP-1559 cancellation fees:", error);
					tx.maxFeePerGas = ethers.parseUnits("75", "gwei");
					tx.maxPriorityFeePerGas = ethers.parseUnits("2", "gwei");
				}
			} else if (feeData.gasPrice) {
				try {
					let gasPriceValue;
					try {
						gasPriceValue = Number(feeData.gasPrice);
					} catch (e) {
						gasPriceValue = 0;
					}
					
					if (!isNaN(gasPriceValue) && gasPriceValue > 0) {
						tx.gasPrice = ethers.getBigInt(Math.floor(gasPriceValue * 1.5)); // 50% higher
					} else {
						tx.gasPrice = ethers.parseUnits("45", "gwei"); // Higher default
					}
				} catch (error) {
					console.error("Error calculating legacy cancellation gas price:", error);
					tx.gasPrice = ethers.parseUnits("45", "gwei");
				}
			} else {
				tx.gasPrice = ethers.parseUnits("45", "gwei");
			}
			
			console.log("Sending cancellation transaction with params:", {
				nonce: tx.nonce, 
				maxFeePerGas: tx.maxFeePerGas ? ethers.formatUnits(tx.maxFeePerGas, "gwei") : undefined, 
				maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.formatUnits(tx.maxPriorityFeePerGas, "gwei") : undefined, 
				gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, "gwei") : undefined
			});
			
			// Sign and send the cancellation transaction
			const transaction = await wallet.sendTransaction(tx);
			console.log(`Cancellation transaction sent: ${transaction.hash}`);
		
			// Wait for transaction to be mined with safety checks
			try {
				const receipt = await transaction.wait();
				
				// Safely extract values
				const blockNumber = receipt.blockNumber ? receipt.blockNumber : null;
				const txHash = receipt.hash || transaction.hash;
				
				return {
					success: true, 
					method: "cancelETHTransaction", 
					message: `Successfully cancelled transaction with nonce ${nonce}`, 
					data: {
						txid: txHash, 
						blockNumber: blockNumber
					}
				};
			} catch (error) {
				console.error("Error waiting for cancellation confirmation:", error);
				return {
					success: true, 
					method: "cancelETHTransaction", 
					message: `Cancellation transaction sent with hash ${transaction.hash}, but confirmation failed.`, 
					data: {
						txid: transaction.hash, 
						confirmationError: error.message, 
						pending: true
					}
				};
			}
		} catch (error) {
			console.error("Transaction cancellation error:", error);
			return {
				success: false, 
				method: "cancelETHTransaction", 
				error: "Failed to cancel transaction.", 
				details: error.message
			};
		}
	}
  
	/**
	 	* Speed up a pending transaction
	 	* @param {string} senderPrivateKey - Private key of the sender
	 	* @param {number} nonce - Nonce of the transaction to speed up
	 	* @param {string} receiverAddress - Original recipient address
	 	* @param {string|number} amountToSend - Original amount in ETH
	 	* @param {number} feeMultiplier - Multiplier for the gas fee (default: 1.5 = 50% increase)
	 	* @returns {Promise<Object>} Speed up result
	*/
	async speedUpTransaction(senderPrivateKey, nonce, receiverAddress, amountToSend, feeMultiplier = 1.5) {
		try {
			// Simply call sendEther with the same parameters but higher gas price
			return await this.sendEther(senderPrivateKey, receiverAddress, amountToSend, {
				nonce: nonce, 
				feeMultiplier: feeMultiplier, 
				waitForConfirmation: true
			});
		} catch (error) {
			console.error("Transaction speed up error:", error);
			return {
				success: false, 
				method: "speedUpETHTransactio", 
				error: "Failed to speed up transaction.", 
				details: error.message
			};
		}
	}

  	/**
   		* Import wallet from private key
   		* @param {string} privateKey - Private key
   		* @returns {Object} Wallet information
   	*/
	importFromPrivateKey(privateKey) {
		try {
			if (!privateKey || typeof privateKey !== 'string') {
				throw new Error("Invalid private key.");
			}
			
			// Create wallet from private key
			const wallet = new ethers.Wallet(privateKey);
			
			return {
				address: wallet.address, 
				privateKey: wallet.privateKey, 
				network: this.currentNetwork
			};
		} catch (error) {
			console.error("Error importing wallet from private key:", error);
			throw new Error(`Failed to import wallet: ${error.message}`);
    	}
  	}

  	/**
	 	* Import wallet from mnemonic phrase
	 	* @param {string} mnemonic - Mnemonic phrase
	 	* @param {string} path - Derivation path (optional)
	 	* @returns {Object} Wallet information
   	*/
	importFromMnemonic(mnemonic, path = "m/44'/60'/0'/0/0") {
		try {
			if (!mnemonic || typeof mnemonic !== 'string') {
				throw new Error("Invalid mnemonic phrase.");
			}
		
			// Create wallet from mnemonic
			const wallet = ethers.Wallet.fromPhrase(mnemonic, path);
		
			return {
				address: wallet.address, 
				privateKey: wallet.privateKey, 
				mnemonic: mnemonic, 
				path: path, 
				network: this.currentNetwork
			};
		} catch (error) {
			console.error("Error importing wallet from mnemonic:", error);
			throw new Error(`Failed to import wallet: ${error.message}`);
		}
  	}

	/**
	 	* Validate an Ethereum address
	 	* @param {string} address - Ethereum address to validate
	 	* @returns {boolean} Whether the address is valid
	*/
	isValidEthereumAddress(address) {
		return ethers.isAddress(address);
	}

	/**
	 	* Get current network name
	 	* @returns {string} Network name
	*/
	getNetworkName() {
		return this.currentNetwork;
	}

  	/**
   		* Get list of supported networks
   		* @returns {string[]} List of supported network names
   */
  	getSupportedNetworks() {
    	return Object.keys(this.networks);
  	}
}

module.exports = new EthereumWalletService();