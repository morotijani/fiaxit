const BitcoinWalletService = require('../service/bitcoin-wallet-service');

class BitcoinController {

  	/**
   		* Get Bitcoin wallet information
   	*/
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
				
				const walletInfo = await BitcoinWalletService.getWalletInfo(address, isTestnet);
				
				if (!walletInfo.success) {
				return res.status(400).json({
					success: false,
					error: walletInfo.error,
					details: walletInfo.details
				});
			}
			
			res.status(200).json({
				success: true,
				method: "getBitcoinWalletInfo",
				data: walletInfo
			});
		} catch (error) {
			console.error("Bitcoin wallet info error:", error);
				res.status(500).json({
					success: false,
					error: "Failed to get Bitcoin wallet information",
					details: error.message
				});
			}
		};
  	};

}

module.exports = new BitcoinController();