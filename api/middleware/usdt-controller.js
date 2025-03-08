const USDTService = require('../service/usdt-service');

class USDTController {
    constructor() {
        this.usdtService = new USDTService();
    }

    /**
        * Get USDT balance for an address
    */
    getBalance = () => {
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
                
                const balance = await this.usdtService.getUSDTBalance(address, isTestnet);
                
                if (balance.error) {
                    return res.status(400).json({
                        success: false,
                        error: balance.error,
                        details: balance.details
                    });
                }
                
                res.status(200).json({
                    success: true,
                    method: "getUSDTBalance",
                    data: balance
                });
            } catch (error) {
                console.error("Balance check error:", error);
                res.status(500).json({
                    success: false,
                    method: "getUSDTBalance",
                    error: "Failed to get balance",
                    details: error.message
                });
            }
        };
    };

    /**
        * Send USDT from one address to another
    */
    sendUSDT = () => {
        return async (req, res) => {
            try {
                const { senderPrivateKey, receiverAddress, amount } = req.body;
                const isTestnet = req.query.testnet !== 'false'; // Default to testnet=true
                
                // Validate required fields
                if (!senderPrivateKey || !receiverAddress || !amount) {
                    return res.status(400).json({
                        success: false,
                        error: "Missing required parameters: senderPrivateKey, receiverAddress, and amount are required"
                    });
                }
                
                // Validate private key format
                let formattedPrivateKey = senderPrivateKey;
                
                // Check if private key has the 0x prefix, add it if missing
                if (!formattedPrivateKey.startsWith('0x')) {
                    formattedPrivateKey = '0x' + formattedPrivateKey;
                }
                
                // Check if private key has the correct length (32 bytes = 64 hex chars + '0x' prefix = 66 chars)
                if (formattedPrivateKey.length !== 66) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid private key format",
                        details: "Private key must be 64 hexadecimal characters (32 bytes)"
                    });
                }
                
                // Check if private key contains only valid hex characters
                if (!/^0x[0-9a-fA-F]{64}$/.test(formattedPrivateKey)) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid private key format",
                        details: "Private key must contain only hexadecimal characters"
                    });
                }
                
                const result = await this.usdtService.SendUSDT(
                    formattedPrivateKey,
                    receiverAddress,
                    amount,
                    isTestnet
                );
                
                if (!result.success) {
                    return res.status(400).json({
                        success: false,
                        error: result.error,
                        details: result.details
                    });
                }
                
                res.status(200).json({
                    success: true,
                    method: "sendUSDT",
                    transaction: result
                });
            } catch (error) {
                console.error("USDT transfer error:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to send USDT",
                    details: error.message
                });
            }
        };
    };


    /**
        * Get detailed wallet information
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
                
                const walletInfo = await this.usdtService.getWalletInfo(address, isTestnet);
                
                if (!walletInfo.success) {
                    return res.status(400).json({
                        success: false,
                        error: walletInfo.error,
                        details: walletInfo.details
                    });
                }
                
                res.status(200).json({
                    success: true,
                    method: "getUSDTWalletInfo",
                    data: walletInfo
                });
            } catch (error) {
                console.error("Wallet info error:", error);
                res.status(500).json({
                    success: false, 
                    method: "getUSDTWalletInfo",
                    error: "Failed to get wallet information",
                    details: error.message
                });
            }
        };
    };
}

module.exports = new USDTController();