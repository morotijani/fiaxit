const bitcoin = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const bip39 = require('bip39');
const axios = require('axios');
const { ECPairFactory } = require('ecpair');


// Initialize BIP32 with the required elliptic curve implementation
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

class BitcoinWalletService {
  constructor() {
    // Default to testnet, can be changed to bitcoin.networks.bitcoin for mainnet
    this.network = bitcoin.networks.testnet;
    
    // BlockCypher API endpoints
    this.apiEndpoints = {
      mainnet: 'https://api.blockcypher.com/v1/btc/main',
      testnet: 'https://api.blockcypher.com/v1/btc/test3'
    };
  }

  /**
   * Generate a new Bitcoin wallet
   * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
   * @returns {Object} Wallet information including address and private key
   */
  generateWallet(isTestnet = true) {
    try {
      // Set network based on isTestnet parameter
      this.network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
      
      // Generate a random mnemonic (seed phrase)
      const mnemonic = bip39.generateMnemonic();
      
      // Convert mnemonic to seed
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      
      // Create a root node from the seed
      const root = bip32.fromSeed(seed, this.network);
      
      // Derive the first account's node (m/44'/0'/0'/0/0)
      const path = isTestnet ? "m/44'/1'/0'/0/0" : "m/44'/0'/0'/0/0";
      const child = root.derivePath(path);
      
      // Get the private key in WIF format
      const privateKey = child.toWIF();
      
      // Create an ECPair from the child node's private key
      const keyPair = ECPair.fromPrivateKey(child.privateKey, { network: this.network });
      
      // Get the public key and create a P2PKH address
      const { address } = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network: this.network
      });
      
      return {
        address,
        privateKey,
        mnemonic,
        network: isTestnet ? 'testnet' : 'mainnet'
      };
    } catch (error) {
      console.error("Error generating Bitcoin wallet:", error);
      throw new Error(`Failed to generate wallet: ${error.message}`);
    }
  }


  /**
   * Get Bitcoin wallet information
   * @param {string} address - Bitcoin address
   * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
   * @returns {Promise<Object>} Wallet information
   */
  async getWalletInfo(address, isTestnet = true) {
    try {
      // Validate Bitcoin address
      if (!this.isValidBitcoinAddress(address, isTestnet)) {
        throw new Error("Invalid Bitcoin address");
      }
      
      const network = isTestnet ? 'testnet' : 'mainnet';
      const apiUrl = `${this.apiEndpoints[network]}/addrs/${address}`;
      
      // Fetch address information from BlockCypher API
      const response = await axios.get(apiUrl);
      const data = response.data;
      
      // Fetch recent transactions
      const txsUrl = `${apiUrl}/full?limit=10`;
      const txsResponse = await axios.get(txsUrl);
      const txsData = txsResponse.data;
      
      // Format transactions
      const transactions = txsData.txs ? txsData.txs.map(tx => {
        // Calculate if this transaction is sending or receiving for this address
        let type = 'unknown';
        let amount = 0;
        
        // Check inputs (sending)
        const isInput = tx.inputs.some(input => 
          input.addresses && input.addresses.includes(address)
        );
        
        // Check outputs (receiving)
        const isOutput = tx.outputs.some(output => 
          output.addresses && output.addresses.includes(address)
        );
        
        if (isInput && isOutput) {
          type = 'self';
          
          // Calculate the change amount
          const totalOut = tx.outputs.reduce((sum, output) => {
            if (output.addresses && !output.addresses.includes(address)) {
              return sum + output.value;
            }
            return sum;
          }, 0);
          
          amount = -totalOut;
        } else if (isInput) {
          type = 'sent';
          
          // Calculate the sent amount (excluding change)
          const totalOut = tx.outputs.reduce((sum, output) => {
            if (output.addresses && !output.addresses.includes(address)) {
              return sum + output.value;
            }
            return sum;
          }, 0);
          
          amount = -totalOut;
        } else if (isOutput) {
          type = 'received';
          
          // Calculate the received amount
          amount = tx.outputs.reduce((sum, output) => {
            if (output.addresses && output.addresses.includes(address)) {
              return sum + output.value;
            }
            return sum;
          }, 0);
        }
        
        return {
          txid: tx.hash,
          type,
          amount: amount / 100000000, // Convert satoshis to BTC
          fee: tx.fees / 100000000,
          confirmations: tx.confirmations || 0,
          blockHeight: tx.block_height || null,
          timestamp: tx.received ? new Date(tx.received).toISOString() : null,
          inputs: tx.inputs.map(input => ({
            addresses: input.addresses || [],
            value: input.output_value ? input.output_value / 100000000 : 0
          })),
          outputs: tx.outputs.map(output => ({
            addresses: output.addresses || [],
            value: output.value ? output.value / 100000000 : 0
          }))
        };
      }) : [];
      
      return {
        success: true,
        address,
        network,
        balance: {
          confirmed: data.balance / 100000000, // Convert satoshis to BTC
          unconfirmed: data.unconfirmed_balance / 100000000,
          total: (data.balance + data.unconfirmed_balance) / 100000000
        },
        transactions,
        txCount: data.n_tx,
        totalReceived: data.total_received / 100000000,
        totalSent: data.total_sent / 100000000,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error getting Bitcoin wallet info:", error);
      return {
        success: false,
        error: "Failed to get wallet info",
        details: error.message
      };
    }
  }

  /**
   * Send Bitcoin from one address to another
   * @param {string} privateKey - Private key in WIF format
   * @param {string} toAddress - Recipient Bitcoin address
   * @param {number} amount - Amount to send in BTC
   * @param {number} feeRate - Fee rate in satoshis per byte
   * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
   * @returns {Promise<Object>} Transaction result
   */
  async sendBitcoin(privateKey, toAddress, amount, feeRate = 10, isTestnet = true) {
    try {
      // Set network based on isTestnet parameter
      this.network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
      
      // Validate recipient address
      if (!this.isValidBitcoinAddress(toAddress, isTestnet)) {
        throw new Error("Invalid recipient Bitcoin address");
      }
      
      // Convert amount from BTC to satoshis
      const amountSatoshis = Math.round(amount * 100000000);
      
      if (amountSatoshis <= 0) {
        throw new Error("Amount must be greater than 0");
      }
      
      // Import the private key
      const keyPair = ECPair.fromWIF(privateKey, this.network);
      
      // Get the sender's address
      const { address: fromAddress } = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network: this.network
      });
      
      // Get UTXOs for the sender's address
      const network = isTestnet ? 'testnet' : 'mainnet';
      const utxoUrl = `${this.apiEndpoints[network]}/addrs/${fromAddress}?unspentOnly=true&includeScript=true`;
      
      const utxoResponse = await axios.get(utxoUrl);
      const utxos = utxoResponse.data.txrefs || [];
      
      if (utxos.length === 0) {
        throw new Error("No unspent outputs found");
      }
      
      // Calculate total available balance
      const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
      
      // Create a new transaction using PSBT
      const psbt = new bitcoin.Psbt({ network: this.network });
      
      // Add inputs (UTXOs)
      let inputAmount = 0;
      for (const utxo of utxos) {
        // Get the full transaction to extract the scriptPubKey
        const txUrl = `${this.apiEndpoints[network]}/txs/${utxo.tx_hash}`;
        const txResponse = await axios.get(txUrl);
        const tx = txResponse.data;
        
        // Find the output we're spending
        const output = tx.outputs[utxo.tx_output_n];
        const scriptPubKey = Buffer.from(output.script, 'hex');
        
        psbt.addInput({
          hash: utxo.tx_hash,
          index: utxo.tx_output_n,
          witnessUtxo: {
            script: scriptPubKey,
            value: utxo.value,
          },
          // For non-segwit inputs, we need to provide the non-witness script
          nonWitnessUtxo: Buffer.from(tx.hex, 'hex'),
        });
        
        inputAmount += utxo.value;
        
        // If we have enough inputs to cover the amount + estimated fee, stop adding more
        if (inputAmount >= amountSatoshis + 10000) { // 10000 satoshis as a rough fee estimate
          break;
        }
      }
      
      // Calculate fee (simplified, in a real app you'd calculate based on tx size)
      const estimatedSize = utxos.length * 180 + 2 * 34 + 10; // rough estimate
      const fee = estimatedSize * feeRate;
      
      // Check if we have enough balance
      if (inputAmount < amountSatoshis + fee) {
        throw new Error(`Insufficient balance. Required: ${(amountSatoshis + fee) / 100000000} BTC, Available: ${inputAmount / 100000000} BTC`);
      }
      
      // Add output for recipient
      psbt.addOutput({
        address: toAddress,
        value: amountSatoshis,
      });
      
      // Add change output if needed
      const changeAmount = inputAmount - amountSatoshis - fee;
      if (changeAmount > 546) { // dust threshold
        psbt.addOutput({
          address: fromAddress,
          value: changeAmount,
        });
      }
      
      // Sign all inputs
      for (let i = 0; i < psbt.inputCount; i++) {
        psbt.signInput(i, keyPair);
      }
      
      // Finalize and build the transaction
      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();
      const txHex = tx.toHex();
      
      // Broadcast the transaction
      const broadcastUrl = `${this.apiEndpoints[network]}/txs/push`;
      const broadcastResponse = await axios.post(broadcastUrl, {
        tx: txHex
      });
      
      return {
        success: true,
        txid: broadcastResponse.data.tx.hash,
        amount: amount,
        fee: fee / 100000000,
        sender: fromAddress,
        recipient: toAddress,
        network: isTestnet ? 'testnet' : 'mainnet'
      };
    } catch (error) {
      console.error("Error sending Bitcoin:", error);
      return {
        success: false,
        error: "Failed to send Bitcoin",
        details: error.message
      };
    }
  }

  /**
   * Validate a Bitcoin address
   * @param {string} address - Bitcoin address to validate
   * @param {boolean} isTestnet - Whether to use testnet (true) or mainnet (false)
   * @returns {boolean} Whether the address is valid
   */
  isValidBitcoinAddress(address, isTestnet = true) {
    try {
      const network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
      
      // Try to decode the address
      bitcoin.address.toOutputScript(address, network);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = BitcoinWalletService;
