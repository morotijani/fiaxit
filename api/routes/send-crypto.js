// sending bitcoin
const axios = require("axios");
const bitcore = require("bitcore-lib");

/**
 * Send Bitcoin from one address to another
 * @param {string} senderPrivateKey - Private key of the sender (WIF format)
 * @param {string} senderAddress - Bitcoin address of the sender
 * @param {string} receiverAddress - Bitcoin address of the recipient
 * @param {number} amountToSend - Amount to send in BTC
 * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
 * @returns {Promise<{txid: string} | {error: string, details: any}>}
 */
module.exports = async function sendBitcoin(
    senderPrivateKey,
    senderAddress,
    receiverAddress, 
    amountToSend,
    isTestnet = true
) {
    try {
        // Validate inputs
        if (!senderPrivateKey || !senderAddress || !receiverAddress || !amountToSend) {
            throw new Error("Missing required parameters");
        }
        
        // Convert BTC to satoshis
        const satoshiToSend = Math.round(amountToSend * 100000000);
        if (satoshiToSend <= 0) {
            throw new Error("Amount must be greater than 0");
        }
        
        // Set network-specific variables
        const networkBaseUrl = isTestnet 
        ? "https://blockstream.info/testnet/api" 
        : "https://blockstream.info/api";
        
        // Get UTXOs for the address
        const utxoResponse = await axios({
            method: "GET",
            url: `${networkBaseUrl}/address/${senderAddress}/utxo`,
            timeout: 5000 // Add timeout for API calls
        });
        
        if (!utxoResponse.data || utxoResponse.data.length === 0) {
            throw new Error("No UTXOs found for this address");
        }
        
        const utxos = utxoResponse.data;
        let totalAmountAvailable = 0;
        let inputs = [];
        
        // Process UTXOs 
        // (UTXOs are the unspent output in transactions ( UTXO represents a certain amount of cryptocurrency that has been authorized by a sender and is available to be spent by a recipient.))
        // getting balance on address
        for (const utxo of utxos) {
            inputs.push({
                satoshis: utxo.value,
                script: bitcore.Script.buildPublicKeyHashOut(senderAddress).toHex(),
                address: senderAddress,
                txId: utxo.txid,
                outputIndex: utxo.vout
            });
            totalAmountAvailable += utxo.value;
        }
        
        // Calculate fee
        const inputCount = inputs.length;
        const outputCount = 2; // Recipient + change address
        const transactionSize = inputCount * 180 + outputCount * 34 + 10 - inputCount;
        
        // Get fee rate - use fixed rate for testnet, dynamic for mainnet
        let feeRate;
        if (isTestnet) {
            feeRate = 1; // 1 sat/byte for testnet
        } else {
            try {
                const feeResponse = await axios.get(
                "https://bitcoinfees.earn.com/api/v1/fees/recommended",
                { timeout: 5000 }
                );
                feeRate = feeResponse.data.hourFee;
            } catch (error) {
                // Fallback fee if API fails
                feeRate = 5; // 5 sat/byte as fallback
                console.warn("Fee estimation API failed, using fallback fee rate:", error.message);
            }
        }
        
        const fee = Math.ceil(transactionSize * feeRate);
        
        // Check if we have enough funds
        if (totalAmountAvailable - satoshiToSend - fee < 0) {
            throw new Error(`Insufficient balance. Available: ${totalAmountAvailable/100000000} BTC, Required: ${(satoshiToSend + fee)/100000000} BTC`);
        }
        
        // Create and sign transaction
        const transaction = new bitcore.Transaction()
            .from(inputs)
            .to(receiverAddress, satoshiToSend)
            .change(senderAddress)
            .fee(fee)
            .sign(senderPrivateKey);
        
        // Verify transaction is valid
        const isValid = transaction.isFullySigned();
        if (!isValid) {
            throw new Error("Transaction failed validation");
        }
        
        // Serialize and broadcast transaction 
        // (send the transaction to the blockchIN)
        const serializedTransaction = transaction.serialize();
        
        const broadcastResponse = await axios({
            method: "POST",
            url: `${networkBaseUrl}/tx`,
            data: serializedTransaction,
            timeout: 10000
        });
        
        return { txid: broadcastResponse.data };
        
    } catch (error) {
        console.error("Bitcoin transaction error:", error.message);
        return {
            error: "Failed to send Bitcoin transaction",
            details: error.message
        };
    }
};