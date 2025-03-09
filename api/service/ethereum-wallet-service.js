const ethers = require('ethers');
const axios = require('axios');

class EthereumWalletService {
  	constructor() {
		// Default provider - can be changed to mainnet or other networks
		this.provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
		
		// Etherscan API endpoints
		this.apiEndpoints = {
			mainnet: 'https://api.etherscan.io/api',
			sepolia: 'https://api-sepolia.etherscan.io/api',
			goerli: 'https://api-goerli.etherscan.io/api'
		};
		
		// Default API key - replace with your own
		this.etherscanApiKey = 'YourEtherscanApiKeyHere';
	}

	/**
	 	* Set the network provider
	 	* @param {string} network - Network name ('mainnet', 'sepolia', 'goerli', etc.)
	 	* @param {string} customRpcUrl - Optional custom RPC URL
	*/
  	setNetwork(network, customRpcUrl = null) {
		if (customRpcUrl) {
			this.provider = new ethers.JsonRpcProvider(customRpcUrl);
			return;
		}

		switch (network) {
		case 'mainnet':
			this.provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/demo');
			break;
		case 'sepolia':
			this.provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/demo');
			break;
		case 'goerli':
			this.provider = new ethers.JsonRpcProvider('https://eth-goerli.g.alchemy.com/v2/demo');
			break;
		default:
			throw new Error(`Unsupported network: ${network}`);
		}
	}

  	/**
   		* Generate a new Ethereum wallet
   		* @returns {Object} Wallet information including address and private key
	*/
  	generateWallet() {
		try {
			// Generate a random wallet
			const wallet = ethers.Wallet.createRandom();
		
			return {
				address: wallet.address,
				privateKey: wallet.privateKey,
				mnemonic: wallet.mnemonic.phrase,
				path: wallet.mnemonic.path
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

			// Get balance in wei
			const balanceWei = await this.provider.getBalance(address);
			
			// Convert wei to ether
			const balanceEth = ethers.formatEther(balanceWei);
			
			return {
				address,
				balanceWei: balanceWei.toString(),
				balanceEth,
				network: await this.getNetworkName()
			};
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
		const network = await this.getNetworkName();
		const etherscanApi = this.apiEndpoints[network] || this.apiEndpoints.mainnet;
		
		// Get balance
		const balanceInfo = await this.getWalletBalance(address);
		
		// Get transaction count (nonce)
		const transactionCount = await this.provider.getTransactionCount(address);
		
		// Get transactions from Etherscan API
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
			}
		});
		
		// Format transactions
		let transactions = [];
		if (transactionsResponse.data.status === '1') {
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
		
		// Get token balances (ERC-20)
		const tokenBalancesResponse = await axios.get(etherscanApi, {
			params: {
				module: 'account',
				action: 'tokenbalance',
				address: address,
				tag: 'latest',
				apikey: this.etherscanApiKey
				}
			});
			
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
		* @param {string} amountToSend - Amount to send in ETH
		* @returns {Promise<{txHash: string} | {error: string, details: any}>}
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

			// Get current gas price
			const feeData = await this.provider.getFeeData();
		
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
			
			// Wait for transaction to be mined
			const receipt = await transaction.wait();

			return {
				txHash: receipt.hash,
				blockNumber: receipt.blockNumber,
				from: senderAddress,
				to: receiverAddress,
				amount: amountToSend,
				gasUsed: receipt.gasUsed.toString(),
				effectiveGasPrice: receipt.effectiveGasPrice.toString()
			};
		} catch (error) {
			console.error("Ethereum transaction error:", error);
			return {
				error: "Failed to send Ethereum transaction",
				details: error.message
			};
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
		* @returns {Promise<string>} Network name
	*/
	async getNetworkName() {
		try {
			const network = await this.provider.getNetwork();
			const chainId = network.chainId;
			
			// Map chain ID to network name
			switch (chainId) {
				case 1n: return 'mainnet';
				case 5n: return 'goerli';
				case 11155111n: return 'sepolia';
				default: return `unknown-${chainId.toString()}`;
			}
		} catch (error) {
			console.error("Error getting network:", error);
			return 'unknown';
		}
	}
}

module.exports = new EthereumWalletService();