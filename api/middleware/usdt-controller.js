const USDTService = require('../service/usdt-service');
const Wallet = require("../models/wallet-model");
const Coin = require("../models/coin-model");
const { decrypt } = require('../helpers/encryption');

class USDTController {

    /**
        * Send USDT from one address to another
    */
    sendUSDT = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const { crypto_id, toAddress, amount } = req.body;

                // Validate required fields
                if (!crypto_id || !toAddress || !amount) {
                    return res.status(400).json({
                        success: false,
                        error: "Missing required parameters: crypto_id, toAddress, and amount are required"
                    });
                }

                // 1. Lookup the sender's wallet to get the private key safely
                const senderWallet = await Wallet.findOne({
                    where: {
                        wallet_id: crypto_id,
                        wallet_for: userId
                    }
                });

                if (!senderWallet) {
                    return res.status(404).json({
                        success: false,
                        error: "Sender wallet not found or unauthorized."
                    });
                }

                // 2. Decrypt the private key internally
                const senderRawKey = decrypt(senderWallet.wallet_privatekey);
                if (!senderRawKey) {
                    return res.status(500).json({
                        success: false,
                        error: "Failed to retrieve wallet keys."
                    });
                }

                // Validate/Format private key (Ethereum/USDT style)
                let formattedPrivateKey = senderRawKey;
                if (!formattedPrivateKey.startsWith('0x')) {
                    formattedPrivateKey = '0x' + formattedPrivateKey;
                }

                // 3. Determine network settings dynamically
                const coin = await Coin.findOne({ where: { coin_symbol: 'USDT' } });
                const isTestnet = coin ? (coin.coin_network !== 'mainnet') : (process.env.NODE_ENV !== 'production');

                const result = await USDTService.SendUSDT(
                    formattedPrivateKey,
                    toAddress,
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
}

module.exports = new USDTController();