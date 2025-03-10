const ethers = require('ethers');
const axios = require('axios');

class EthereumWalletService {
	constructor() {
		// Initialize with a default network
		this.currentNetwork = 'sepolia';
		
		// Your Alchemy API key
		const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY //|| 'demo'; // Fallback to demo if not set
		
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
			throw new Error(`Unsupported network: ${networkName}`);
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
			throw new Error(`Provider initialization failed: ${error.message}`);
		}
	}

	/**
	 	* Set the network provider
	 	* @param {string} network - Network name ('mainnet', 'sepolia', 'goerli', etc.)
	 	* @param {string} customRpcUrl - Optional custom RPC URL
	*/
	setNetwork(network = 'sepolia', customRpcUrl = null) {
		try {
			if (customRpcUrl) {
				// If custom RPC URL is provided, use it with the network's chain ID
				const networkConfig = this.networks[network];
				if (!networkConfig) {
					throw new Error(`Unsupported network: ${network}`);
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
			throw new Error(`Network change failed: ${error.message}`);
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
			throw new Error(`Failed to generate wallet: ${error.message}`);
		}
  	}

	/**
	 	* Get Ethereum wallet balance
	 	* @param {string} address - Ethereum address
	 	* @returns {Promise<Object>} Balance information
	*/
	async getWalletBalance(address) {
		try {
			if (!this.isValidEthereumAddress(address)) {
				throw new Error("Invalid Ethereum address");
			}

			// Add retry logic
			let attempts = 0;
			const maxAttempts = 3;
			let lastError;
			
			while (attempts < maxAttempts) {
				try {
					const balanceWei = await this.provider.getBalance(address);
					const balanceEth = ethers.formatEther(balanceWei);

					return {
						address,
						balanceWei: balanceWei.toString(),
						balanceEth,
						network: this.currentNetwork
					};
				} catch (error) {
					lastError = error;
					attempts++;
					if (attempts === maxAttempts) break;

					// Exponential backoff
					await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
				}
			}
      
      		throw lastError || new Error("Failed to get balance after multiple attempts");
		} catch (error) {
			console.error("Error getting Ethereum wallet balance:", error);
			throw new Error(`Failed to get wallet balance: ${error.message}`);
		}
	}

  	/**
		* Get Ethereum wallet information including transactions
		* @param {string} address - Ethereum address
		* @returns {Promise<Object>} Wallet information
   	*/
	async getWalletInfo(address) {
		try {
			if (!this.isValidEthereumAddress(address)) {
				throw new Error("Invalid Ethereum address");
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

			return {
				success: true, 
				address, 
				network, 
				balance: {
					wei: balanceInfo.balanceWei, 
					ether: balanceInfo.balanceEth
				},
				transactionCount, 
				transactions, 
				lastUpdated: new Date().toISOString()
			};
		} catch (error) {
      		console.error("Error getting Ethereum wallet info:", error);
			return {
				success: false,
				error: "Failed to get wallet info",
				details: error.message
			};
		}
  	}

  	/**
		* Send Ethereum from one address to another
	 	* @param {string} senderPrivateKey - Private key of the sender
	 	* @param {string} receiverAddress - Ethereum address of the recipient
	 	* @param {string|number} amountToSend - Amount to send in ETH
   		* @returns {Promise<Object>} Transaction result
   	*/
	async sendEther(senderPrivateKey, receiverAddress, amountToSend) {
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
				throw new Error(`Insufficient balance. Available: ${ethers.formatEther(balanceWei)} ETH, Required: ${amountToSend} ETH`);
			}

			// Get current gas price with retry logic
			let feeData;
			try {
				feeData = await this.provider.getFeeData();
			} catch (error) {
				console.error("Error getting fee data:", error);
				// Fallback to reasonable defaults if fee data can't be fetched
				feeData = {
					maxFeePerGas: ethers.parseUnits("50", "gwei"),
					maxPriorityFeePerGas: ethers.parseUnits("1.5", "gwei")
				};
			}

			// Create transaction object
			const tx = {
				to: receiverAddress,
				value: amountWei,
				gasLimit: 21000, // Standard gas limit for ETH transfer
				maxFeePerGas: feeData.maxFeePerGas,
				maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
				nonce: await this.provider.getTransactionCount(senderAddress)
			};

			// Sign and send transaction
			const transaction = await wallet.sendTransaction(tx);
			console.log(`Transaction sent: ${transaction.hash}`);

			// Wait for transaction to be mined
			const receipt = await transaction.wait();
			console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

			return {
				success: true,
				txHash: receipt.hash,
				blockNumber: receipt.blockNumber,
				from: senderAddress,
				to: receiverAddress,
				amount: amountToSend,
				gasUsed: receipt.gasUsed.toString(),
				effectiveGasPrice: receipt.effectiveGasPrice.toString(),
				network: this.currentNetwork
			};
		} catch (error) {
			console.error("Ethereum transaction error:", error);
			return {
				success: false,
				error: "Failed to send Ethereum transaction",
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
				throw new Error("Invalid private key");
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
				throw new Error("Invalid mnemonic phrase");
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