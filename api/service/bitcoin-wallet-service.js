const axios = require("axios")
const bitcore = require("bitcore-lib")

class BitcoinWalletService {

    // Get wallet balance
    getWalletBalance = () => {
        return async (req, res, next) => {
            try {
                const walletAddress = req.params.address;
                const isTestnet = req.query.testnet !== 'false'; // Default to testnet=true
                if (!walletAddress) {
                    return res.status(400).json({
                        success: false,
                        error: "Wallet address is required"
                    });
                }
                
                // Validate Bitcoin address format
                try {
                    // This will throw an error if the address is invalid
                    new bitcore.Address(walletAddress);
                } catch (error) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid Bitcoin address format"
                    });
                }
                
                // Set network-specific variables
                const networkBaseUrl = isTestnet 
                    ? "https://blockstream.info/testnet/api" 
                    : "https://blockstream.info/api";
                
                // Get UTXOs for the address
                const utxoResponse = await axios({
                    method: "GET",
                    url: `${networkBaseUrl}/address/${walletAddress}/utxo`,
                    timeout: 5000
                });
                
                const utxos = utxoResponse.data || [];
                
                // Calculate total balance from UTXOs
                let totalBalance = 0;
                for (const utxo of utxos) {
                    totalBalance += utxo.value;
                }
                
                // Convert satoshis to BTC for easier reading
                const balanceBTC = totalBalance / 100000000;
                
                // Format the response
                res.status(200).json({
                    success: true,
                    method: "getWalletBalance", 
                    data: {
                        address: walletAddress,
                        network: isTestnet ? 'testnet' : 'mainnet',
                        balance: {
                            satoshis: totalBalance,
                            btc: balanceBTC.toFixed(8)
                        },
                        utxos: {
                            count: utxos.length,
                            details: utxos.map(utxo => ({
                                txid: utxo.txid,
                                vout: utxo.vout,
                                value: utxo.value,
                                status: utxo.status
                            }))
                        }
                    }
                });
            } catch(err) {
                console.error("Wallet balance error:", err);
                res.status(422).json({
                    success: false,
                    error: err.message || "An error occurred while fetching wallet balance"
                });
            }
        }
    }

    // Get bitcoin wallet info
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
                
                // Validate Bitcoin address format
                try {
                    // This will throw an error if the address is invalid
                    new bitcore.Address(address);
                } catch (error) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid Bitcoin address format"
                    });
                }
                
                // Set network-specific variables
                const networkBaseUrl = isTestnet 
                    ? "https://blockstream.info/testnet/api" 
                    : "https://blockstream.info/api";
                
                // Get UTXOs for the address
                const utxoResponse = await axios({
                    method: "GET",
                    url: `${networkBaseUrl}/address/${address}/utxo`,
                    timeout: 5000
                });
                
                const utxos = utxoResponse.data || [];
                
                // Calculate total balance from UTXOs
                let totalBalance = 0;
                for (const utxo of utxos) {
                    totalBalance += utxo.value;
                }
                
                // Convert satoshis to BTC for easier reading
                const balanceBTC = totalBalance / 100000000;
                
                // Get transaction history (optional)
                const txHistoryResponse = await axios({
                    method: "GET",
                    url: `${networkBaseUrl}/address/${address}/txs`,
                    timeout: 5000
                }).catch(error => {
                    console.warn("Could not fetch transaction history:", error.message);
                    return { data: [] };
                });
                
                const txHistory = txHistoryResponse.data || [];
                
                // Process transaction history to get recent transactions
                const recentTransactions = txHistory.slice(0, 5).map(tx => {
                    return {
                        txid: tx.txid,
                        confirmed: tx.status.confirmed,
                        timestamp: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : null,
                        fee: tx.fee || 0
                    };
                });
                
                // Format the response
                res.status(200).json({
                    success: true,
                    method: "getWalletInfo", 
                    data: {
                        address: address,
                        network: isTestnet ? 'testnet' : 'mainnet',
                        balance: {
                            satoshis: totalBalance,
                            btc: balanceBTC.toFixed(8)
                        },
                        utxos: {
                            count: utxos.length,
                            details: utxos.map(utxo => ({
                                txid: utxo.txid,
                                vout: utxo.vout,
                                value: utxo.value,
                                status: utxo.status
                            }))
                        },
                        recentTransactions: recentTransactions,
                        transactionCount: txHistory.length
                    }
                });
            } catch (error) {
                console.error("Wallet info error:", error);
                res.status(500).json({
                    success: false,
                    error: "Failed to get wallet information",
                    details: error.message
                });
            }
        }
    }

}

module.exports = new BitcoinWalletService() // instantiate class and add to module so that we can use it anywhere else