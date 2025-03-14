const ethereumService = require('../service/ethereum-wallet-service');

class EthereumController {
	/**
	 	* Generate a new Ethereum wallet
	 	* @param {Object} req - Express request object
	 	* @param {Object} res - Express response object
	*/
	generateWallet = (req, res) => {
		try {
			// Check if a specific network was requested
			const network = req.query.network || 'sepolia';
			
			// Set the network if specified
			if (network) {
				ethereumService.setNetwork(network);
			}
			
			// Generate a new wallet
			const wallet = ethereumService.generateWallet();
			
			res.status(200).json({
				success: true,
				method: "generateWallet",
				data: {
					...wallet, // Spread syntax in action!
					network
				}
      		});
		} catch (error) {
			console.error("Wallet generation error:", error);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to generate Ethereum wallet"
			});
		}
	}

	/**
		* Get wallet balance
		* @param {Object} req - Express request object
		* @param {Object} res - Express response object
	*/
	getWalletBalance = async (req, res) => {
		try {
			const walletAddress = req.params.address;
			const network = req.query.network || 'sepolia';
		
			if (!walletAddress) {
				return res.status(400).json({
					success: false, 
					error: "Wallet address is required"
				});
			}
			
			// Set the network if specified
			if (network) {
				ethereumService.setNetwork(network);
			}
			
			// Validate Ethereum address format
			if (!ethereumService.isValidEthereumAddress(walletAddress)) {
				return res.status(400).json({
					success: false,
					error: "Invalid Ethereum address format"
				});
			}
			
			// Get wallet balance
			const balanceInfo = await ethereumService.getWalletBalance(walletAddress);
		
			res.status(200).json({
				success: true, 
				method: "getWalletBalance", 
				data: balanceInfo
			});
		} catch (error) {
			console.error("Wallet balance error:", error);
			res.status(422).json({
				success: false, 
				error: error.message || "An error occurred while fetching wallet balance"
			});
		}
	}

	/**
		* Get wallet information including transactions
		* @param {Object} req - Express request object
		* @param {Object} res - Express response object
	*/
	getWalletInfo = async (req, res) => {
		try {
			const walletAddress = req.params.address;
			const network = req.query.network || 'sepolia';
			
			if (!walletAddress) {
				return res.status(400).json({
					success: false,
					error: "Wallet address is required"
				});
			}
			
			// Set the network if specified
			if (network) {
				ethereumService.setNetwork(network);
			}
			
			// Validate Ethereum address format
			if (!ethereumService.isValidEthereumAddress(walletAddress)) {
				return res.status(400).json({
					success: false,
					error: "Invalid Ethereum address format"
				});
			}
			
			// Get wallet info
			const walletInfo = await ethereumService.getWalletInfo(walletAddress);
			
			if (!walletInfo.success) {
				return res.status(422).json({
					success: false,
					error: walletInfo.error,
					details: walletInfo.details
				});
			}
		
			res.status(200).json({
				success: true,
				method: "getWalletInfo",
				data: walletInfo
			});
		} catch (error) {
			console.error("Wallet info error:", error);
			res.status(422).json({
				success: false,
				error: error.message || "An error occurred while fetching wallet information"
			});
		}
	}

  	/**
   		* Validate Ethereum address
		* @param {Object} req - Express request object
		* @param {Object} res - Express response object
	*/
  	validateAddress = (req, res) => {
    	try {
      		const { address } = req.params;
      
			if (!address) {
				return res.status(400).json({
				success: false,
				error: "Address is required"
				});
			}
			
			const isValid = ethereumService.isValidEthereumAddress(address);
			
			res.status(200).json({
				success: true,
				method: "validateAddress",
				data: {
					address, 
					isValid
				}
			});
		} catch (error) {
			console.error("Address validation error:", error);
			res.status(422).json({
				success: false,
				error: error.message || "An error occurred while validating the address"
			});
		}
	}
}

// Export the controller as a singleton
module.exports = new EthereumController();