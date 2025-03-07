const BitcoinWalletService = require('../service/bitcoin-wallet-service');

class BitcoinController {
  constructor() {
    this.bitcoinService = new BitcoinWalletService();
  }

  /**
   * Generate a new Bitcoin wallet
   */
  generateWallet = () => {
    return (req, res) => {
      try {
        const isTestnet = req.query.testnet !== 'false'; // Default to testnet=true
        const wallet = this.bitcoinService.generateWallet(isTestnet);
        
        res.status(201).json({
          success: true,
          method: "generateBitcoinWallet",
          wallet: {
            address: wallet.address,
            privateKey: wallet.privateKey,
            mnemonic: wallet.mnemonic,
            network: wallet.network
          }
        });
      } catch (error) {
        console.error("Bitcoin wallet generation error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to generate Bitcoin wallet",
          details: error.message
        });
      }
    };
  };

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
        
        const walletInfo = await this.bitcoinService.getWalletInfo(address, isTestnet);
        
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

  /**
   * Send Bitcoin
   */
  sendBitcoin = () => {
    return async (req, res) => {
      try {
        const { privateKey, toAddress, amount, feeRate } = req.body;
        const isTestnet = req.query.testnet !== 'false'; // Default to testnet=true
        
        // Validate required fields
        if (!privateKey || !toAddress || !amount) {
          return res.status(400).json({
            success: false,
            error: "Missing required parameters: privateKey, toAddress, and amount are required"
          });
        }
        
        const result = await this.bitcoinService.sendBitcoin(
          privateKey,
          toAddress,
          parseFloat(amount),
          feeRate || 10,
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
          method: "sendBitcoin",
          transaction: result
        });
      } catch (error) {
        console.error("Bitcoin transfer error:", error);
        res.status(500).json({
          success: false,
          error: "Failed to send Bitcoin",
          details: error.message
        });
      }
    };
  };
}

module.exports = new BitcoinController();
