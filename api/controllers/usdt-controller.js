const USDTService = require('../middleware/usdt-service');

class USDTController {
    constructor() {
        this.usdtService = new USDTService();
    }

    /**
     * Generate a new Ethereum wallet
     */
    generateWallet = () => {
        return async (req, res) => {
            try {
                const wallet = this.usdtService.generateWallet();
                
                res.status(201).json({
                    success: true,
                    method: "generateWallet",
                    wallet: {
                        address: wallet.address,
                        privateKey: wallet.privateKey,
                        mnemonic: wallet.mnemonic
                    }
                });
            } catch (error) {
                console.error("Wallet generation error:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to generate wallet",
                    details: error.message
                });
            }
        };
    };

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
                    method: "getBalance",
                    data: balance
                });
            } catch (error) {
                console.error("Balance check error:", error);
                res.status(500).json({
                    success: false,
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
                
                const result = await this.usdtService.sendUSDT(
                    senderPrivateKey,
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
                    method: "getWalletInfo",
                    data: walletInfo
                });
            } catch (error) {
                console.error("Wallet info error:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get wallet information",
                    details: error.message
                });
            }
        };
    };
}

module.exports = new USDTController();