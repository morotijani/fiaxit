const ethers = require("ethers");
const Web3 = require("web3");
const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config()

// USDT ERC-20 Contract ABI (Only the functions we need)
const USDT_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }, {
        "constant": false,
        "inputs":[
            {"name": "_to", "type": "address"}, 
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}], 
        "type": "function"
    }, {
        "constant": true, 
        "inputs": [], 
        "name": "decimals", 
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
];

// USDT Contract Address
const USDT_CONTRACT_ADDRESS = {
    mainnet: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum Mainnet 
    sepolia: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06"  // Sepolia Testnet (example address)
}

// Infura or Alchemy endpoints
const NETWORK_ENDPOINTS = {
    mainnet: process.env.ETH_MAINNET_ENDPOINT || "https://mainnet.infura.io/v3/2e3b84a24d1646f199566a2fb6c1e514", 
    sepolia: process.env.ETH_SEPOLIA_ENDPOINT || "https://sepolia.infura.io/v3/2e3b84a24d1646f199566a2fb6c1e514"
}

class USDTService {

    /**
     * Generate a new Ethereum wallet
     * @returns {Object} Wallet information including address and private key
     */
    generateWallet() {
        try {
            // Create a random wallet
            const wallet = ethers.Wallet.createRandom();

            return {
                address: wallet.address, 
                privateKey: wallet.privateKey,
                mnemonic: wallet.mnemonic.phrase
            }
        } catch(error) {
            console.error("Error generating wallet:", error);
            throw new Error(`Failed to generate wallet: ${error.message}`);
        }
    }

    /**
     * Get USDT balance for an Ethereum address
     * @param {string} address - Ethereum address to check
     * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
     * @returns {Promise<Object>} Balance information
     */
    async getUSDTBalance(address, isTestnet = true) {
        try {
            if (!ethers.isAddress(address)) {
                throw new Error("Invalid Ethereum address");
            }

            const network = isTestnet ? "sepolia" : "mainnet";
            const provider = new ethers.JsonRpcProvider(NETWORK_ENDPOINTS[network]);

            // Create USDT contract instance 
            const usdtContract = new ethers.Contract(
                USDT_CONTRACT_ADDRESS[network],
                USDT_ABI,
                provider
            );

            // Get token decimals with fallback
            let decimals;
            try {
                decimals = await usdtContract.decimals();
                // Convert BigInt to Number if needed
                decimals = typeof decimals === 'bigint' ? Number(decimals) : decimals;
            } catch (error) {
                console.warn("Failed to get decimals, using default value of 6:", error.message);
                decimals = 6;
            }

            // Get raw balance with error handling
            let rawBalance;
            try {
                rawBalance = await usdtContract.balanceOf(address);
            } catch (error) {
                console.warn("Failed to get balance, using 0:", error.message);
                rawBalance = 0n;
            }

            // Convert to human-readable format 
            const balance = ethers.formatUnits(rawBalance, decimals);

            // Get ETH balance as well (for gas)
            const ethBalance = await provider.getBalance(address);
            const ethBalanceFormatted = ethers.formatEther(ethBalance);

            return {
                address,
                network: isTestnet ? "sepolia" : "mainnet",
                usdt: {
                    balance: balance, 
                    rawBalance: rawBalance.toString(), // Ensure BigInt is converted to string
                    decimals: decimals
                }, 
                eth: {
                    balance: ethBalanceFormatted, 
                    rawBalance: ethBalance.toString() // Ensure BigInt is converted to string
                }
            };
        } catch(error) {
            console.error("Error getting USDT balance:", error);
            return {
                error: "Failed to get USDT balance",
                details: error.message
            };
        }
    }



    /**
     * Send USDT from one address to another
     * @param {string} senderPrivateKey - Private key of the sender
     * @param {string} receiverAddress - Ethereum address of the recipient
     * @param {number|string} amount - Amount of USDT to send
     * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
     * @returns {Promise<Object>} Transaction result
     */
    async SendUSDT(senderPrivateKey, receiverAddress, amount, isTestnet = true) {
        try {
            if (!senderPrivateKey || !receiverAddress || !amount) {
                throw new Error("Missing required parameters");
            }

            // Validate and format private key
            if (typeof senderPrivateKey !== 'string') {
                throw new Error("Private key must be a string");
            }
            
            // Ensure private key has 0x prefix
            if (!senderPrivateKey.startsWith('0x')) {
                senderPrivateKey = '0x' + senderPrivateKey;
            }
            
            // Validate private key format
            if (!/^0x[0-9a-fA-F]{64}$/.test(senderPrivateKey)) {
                throw new Error("Invalid private key format. Must be a 64-character hex string with 0x prefix.");
            }

            if (!ethers.isAddress(receiverAddress)) {
                throw new Error("Invalid receiver Ethereum address")
            }

            const network = isTestnet ? "sepolia" : "mainnet";

            // Create provider with sender's private key 
            const provider = new ethers.JsonRpcProvider(NETWORK_ENDPOINTS[network]);
            
            // Create wallet with validated private key
            let wallet;
            try {
                wallet = new ethers.Wallet(senderPrivateKey, provider);
            } catch (error) {
                throw new Error(`Invalid private key: ${error.message}`);
            }
        
            const senderAddress = wallet.address;

            // Create contract instance
            const usdtContract = new ethers.Contract(
                USDT_CONTRACT_ADDRESS[network],
                USDT_ABI,
                wallet
            );

            // Get token decimals 
            const decimals = await usdtContract.decimals();

            // Convert amount to token units (USDT typically has 6 decimals)
            const amountInTokenUnits = ethers.parseUnits(amount.toString(), decimals);

            // Check sender's USDT balance 
            const senderBalance = await usdtContract.balanceOf(senderAddress);
            
            // In ethers v6, BigNumber methods are different
            if (senderBalance < amountInTokenUnits) {
                throw new Error(`Insufficient USDT balance. Available: ${ethers.formatUnits(senderBalance, decimals)}, Required: ${amount}`);
            }

            // Check sender's ETH balance for gas 
            const ethBalance = await provider.getBalance(senderAddress);
            const gasPrice = await provider.getFeeData().then(data => data.gasPrice);
            const gasLimit = 100000n; // Estimated gas for ERC-20 transfers
            const gasCost = gasPrice * gasLimit;

            if (ethBalance < gasCost) {
                throw new Error(`Insufficient ETH balance for gas. Required: ${ethers.formatEther(gasCost)} ETH, Available: ${ethers.formatEther(ethBalance)} ETH`);
            }

            // Send USDT transaction
            const tx = await usdtContract.transfer(receiverAddress, amountInTokenUnits, {
                gasLimit: gasLimit,
                gasPrice: gasPrice
            });

            // Wait for transaction to be mined
            const receipt = await tx.wait();
            
            return {
                success: true, 
                transactionHash: receipt.hash,
                sender: senderAddress,
                receiver: receiverAddress,
                amount: amount,
                network: network, 
                blockNumber: receipt.blockNumber ? receipt.blockNumber.toString() : null,
                gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : null,
            }
        } catch(error) {
            console.error("Error sending USDT:", error);
            return {
                success: false, 
                error: "Failed to send USDT",
                details: error.message
            }
        }
    }

    /**
     * Get detailed wallet information including transaction history
     * @param {string} address - Ethereum address
     * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
     * @returns {Promise<Object>} Wallet information
     */
    async getWalletInfo(address, isTestnet = true) {
        try {
            if (!ethers.isAddress(address)) {
                throw new Error("Invalid Ethereum address")
            }

            const network = isTestnet ? "sepolia" : "mainnet";
            const provider = new ethers.JsonRpcProvider(NETWORK_ENDPOINTS[network]);

            // Get USDT balance
            const usdtBalance = await this.getUSDTBalance(address, isTestnet);

            // Get ETH balance 
            const ethBalance = await provider.getBalance(address);

            // Get transaction count
            const txCount = await provider.getTransactionCount(address);

            // Get recent transactions
            const blockNumber = await provider.getBlockNumber();
            
            // Safely get blocks with transactions
            const recentBlocks = await Promise.all(
                Array.from({ length: 10 }, (_, i) => {
                    // Ensure we don't request negative block numbers
                    const blockToFetch = blockNumber - i;
                    if (blockToFetch < 0) return Promise.resolve(null);
                    
                    // Use getBlock with includeTransactions=true for ethers.js v6
                    return provider.getBlock(blockToFetch, true)
                        .catch(err => {
                            console.warn(`Failed to fetch block ${blockToFetch}:`, err.message);
                            return null;
                        });
                })
            );


            // Filter out null blocks and process transactions
            const recentTransactions = recentBlocks
                .filter(block => block !== null)
                .flatMap(block => block.transactions || [])
                .filter(tx => {
                    // Ensure tx.from and tx.to exist before comparing
                    return tx && tx.from && 
                        (tx.from.toLowerCase() === address.toLowerCase() || 
                            (tx.to && tx.to.toLowerCase() === address.toLowerCase()));
                })
                .map(tx => {
                    // Find the block that contains this transaction
                    const txBlock = recentBlocks.find(b => b && b.number === tx.blockNumber);
                    
                    return {
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to || 'Contract Creation',
                        value: ethers.formatEther(tx.value),
                        timestamp: txBlock ? 
                            new Date(Number(txBlock.timestamp) * 1000).toISOString() : 
                            new Date().toISOString(),
                        blockNumber: tx.blockNumber ? tx.blockNumber.toString() : null,
                        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : '0',
                        gasLimit: tx.gasLimit ? tx.gasLimit.toString() : '0',
                        nonce: tx.nonce ? tx.nonce.toString() : '0'
                    };
                })
                .slice(0, 20); // Limit to 20 most recent transactions

            // Check for USDT transfers using logs
            const usdtTransfers = [];
            try {
                const usdtContract = new ethers.Contract(
                    USDT_CONTRACT_ADDRESS[network],
                    [
                        "event Transfer(address indexed from, address indexed to, uint256 value)"
                    ],
                    provider
                );
                
                // Look for transfers to/from this address in the last 10000 blocks
                const fromBlock = Math.max(0, blockNumber - 10000);
                
                // Create filters for sent and received transfers
                const sentFilter = usdtContract.filters.Transfer(address, null);
                const receivedFilter = usdtContract.filters.Transfer(null, address);
                
                // Query logs
                const [sentLogs, receivedLogs] = await Promise.all([
                    usdtContract.queryFilter(sentFilter, { fromBlock }).catch(() => []),
                    usdtContract.queryFilter(receivedFilter, { fromBlock }).catch(() => [])
                ]);
                
                // Process logs
                const allLogs = [...sentLogs, ...receivedLogs]
                    .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
                    
                for (const log of allLogs.slice(0, 20)) {
                    const decimals = 6; // USDT typically has 6 decimals
                    
                    // Try to get the block for timestamp information
                    let timestamp;
                    try {
                        const block = await provider.getBlock(log.blockNumber);
                        timestamp = block ? new Date(Number(block.timestamp) * 1000).toISOString() : new Date().toISOString();
                    } catch (err) {
                        timestamp = new Date().toISOString();
                    }
                    
                    usdtTransfers.push({
                        hash: log.transactionHash,
                        from: log.args.from,
                        to: log.args.to,
                        value: ethers.formatUnits(log.args.value, decimals),
                        type: log.args.from.toLowerCase() === address.toLowerCase() ? 'sent' : 'received',
                        token: 'USDT',
                        blockNumber: log.blockNumber,
                        timestamp: timestamp
                    });
                }
            } catch (err) {
                console.warn("Failed to fetch USDT transfers:", err.message);
                // Continue without USDT transfers if this fails
            }

            // Get token balances
            const tokenBalances = [];
            if (usdtBalance && !usdtBalance.error) {
                tokenBalances.push({
                    token: 'USDT',
                    balance: usdtBalance.usdt.balance,
                    rawBalance: usdtBalance.usdt.rawBalance,
                    decimals: usdtBalance.usdt.decimals
                });
            }

            return {
                success: true,
                address, 
                network: isTestnet ? "sepolia" : "mainnet",
                usdt: usdtBalance && !usdtBalance.error ? usdtBalance.usdt : { balance: "0", rawBalance: "0", decimals: 6 },
                eth: {
                    balance: ethers.formatEther(ethBalance),
                    rawBalance: ethBalance.toString()
                },
                txCount: txCount.toString(),
                recentTransactions: recentTransactions,
                usdtTransfers: usdtTransfers,
                tokenBalances: tokenBalances,
                lastUpdated: new Date().toISOString()
            };

        } catch(error) {
            console.error("Error getting wallet info:", error);
            return {
                success: false, 
                error: "Failed to get wallet info",
                details: error.message
            }
        }
    }
}

module.exports = USDTService;