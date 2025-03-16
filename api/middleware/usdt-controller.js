const USDTService = require('../service/usdt-service');

class USDTController {

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
                
                const result = await USDTService.SendUSDT(
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
}

module.exports = new USDTController();