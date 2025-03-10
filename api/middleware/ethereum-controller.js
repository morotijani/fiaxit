const ethereumService = require('../service/ethereum-wallet-service');

class EthereumController {
	/**
	 	* Generate a new Ethereum wallet
	 	* @param {Object} req - Express request object
	 	* @param {Object} res - Express response object
	*/

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
		* Send Ethereum from one address to another
		* @param {Object} req - Express request object
		* @param {Object} res - Express response object
	*/
	sendEther = async (req, res) => {
		try {
			const { senderPrivateKey, receiverAddress, amount } = req.body;
			const network = req.body.network || 'sepolia';
			
			// Validate required fields
			if (!senderPrivateKey || !receiverAddress || !amount) {
				return res.status(400).json({
					success: false, 
					error: "Missing required parameters: senderPrivateKey, receiverAddress, and amount are required"
				});
			}
			
			// Set the network if specified
			if (network) {
				ethereumService.setNetwork(network);
			}
			
			// Validate receiver address
			if (!ethereumService.isValidEthereumAddress(receiverAddress)) {
				return res.status(400).json({
					success: false,
					error: "Invalid receiver Ethereum address"
				});
			}
      
			// Send Ethereum
			const result = await ethereumService.sendEther(senderPrivateKey, receiverAddress, amount);
			
			if (result.error) {
				return res.status(422).json({
				success: false,
				error: result.error,
				details: result.details
				});
			}
			
			res.status(200).json({
				success: true,
				method: "sendEther",
				data: result
			});
		} catch (error) {
			console.error("Send Ether error:", error);
			res.status(422).json({
				success: false,
				error: error.message || "An error occurred while sending Ethereum"
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