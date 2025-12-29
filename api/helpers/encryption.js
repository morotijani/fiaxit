const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const algorithm = 'aes-256-cbc';
const ivLength = 16;
const debugLogPath = path.join(__dirname, '../../encryption_debug.txt');

// Constants used for fallback
const DEFAULT_KEY_STRING = 'default_secret_key_at_least_32_chars_long_12345';
const DEFAULT_HASHED_KEY = crypto.createHash('sha256').update(DEFAULT_KEY_STRING).digest();

function debugLog(msg) {
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(debugLogPath, `[${timestamp}] ${msg}\n`);
    } catch (e) {
        console.error('Failed to write to debug log:', e.message);
    }
}

/**
 * Derives a consistent 32-byte key from the environment variable.
 * Fallback to a hardcoded string if ENV is missing.
 */
function getEncryptionKey() {
    const rawKey = process.env.ENCRYPTION_KEY || DEFAULT_KEY_STRING;
    // Hash to exactly 32 bytes to satisfy AES-256 requirement
    const k = crypto.createHash('sha256').update(String(rawKey)).digest();
    debugLog(`Derived Key (from env/fallback). RawKey defined? ${!!process.env.ENCRYPTION_KEY}. Key length: ${k.length}`);
    return k;
}

const key = getEncryptionKey();

/**
 * Encrypts sensitive text using AES-256-CBC
 * @param {string} text 
 * @returns {string} iv:encryptedText (hex)
 */
function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(ivLength);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts text encrypted by the above function.
 * Supports fallback for legacy keys (before hashing was introduced).
 * @param {string} text iv:encryptedText
 * @returns {string} decryptedText
 */
function decrypt(text) {
    if (!text) {
        debugLog('Decrypt FAILED: Input text is null or empty.');
        return null;
    }
    if (!text.includes(':')) {
        debugLog(`Decrypt FAILED: Missing colon. Format suspect? Raw start: ${text.substring(0, 10)}...`);
        return null;
    }

    try {
        const parts = text.split(':');
        const ivHex = parts.shift();
        const encryptedHex = parts.join(':');

        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');
        debugLog(`Attempting Decrypt. IV length: ${iv.length}. Encrypted length: ${encryptedText.length}.`);

        const rawKey = process.env.ENCRYPTION_KEY || DEFAULT_KEY_STRING;
        debugLog(`System RawKey status: ${process.env.ENCRYPTION_KEY ? 'DEFINED' : 'FALLBACK'}. Key prefix: ${String(rawKey).substring(0, 4)}...`);

        // 1. Try with the current system key (hashed)
        try {
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encryptedText, null, 'utf8');
            decrypted += decipher.final('utf8');
            debugLog('Primary decryption SUCCESS.');
            return decrypted;
        } catch (primaryErr) {
            debugLog(`Primary decryption FAILED: ${primaryErr.message}`);

            // 2. IMPORTANT FALLBACK: Hashed Default Key (Required for legacy wallets created without ENCRYPTION_KEY)
            try {
                debugLog('Trying Legacy Variation: Hashed Default Key...');
                const decipherLegacy = crypto.createDecipheriv(algorithm, DEFAULT_HASHED_KEY, iv);
                let decLegacy = decipherLegacy.update(encryptedText, null, 'utf8');
                decLegacy += decipherLegacy.final('utf8');
                debugLog('Legacy Hashed Default Key SUCCESS.');
                return decLegacy;
            } catch (errLegacy) {
                debugLog(`Legacy Hashed Default Key FAILED: ${errLegacy.message}`);
            }

            // 3. Fallback Variation A: Sliced/Padded buffer of CURRENT raw string
            try {
                const legacyKeyA = Buffer.alloc(32);
                Buffer.from(String(rawKey)).copy(legacyKeyA);
                const decipherA = crypto.createDecipheriv(algorithm, legacyKeyA, iv);
                let decA = decipherA.update(encryptedText, null, 'utf8');
                decA += decipherA.final('utf8');
                debugLog('Legacy Variation A SUCCESS.');
                return decA;
            } catch (errA) {
                debugLog(`Legacy Variation A FAILED: ${errA.message}`);
            }

            // 4. Fallback Variation B: Just the first 32 chars of the CURRENT string raw
            if (rawKey.length >= 32) {
                try {
                    const legacyKeyB = rawKey.substring(0, 32);
                    const decipherB = crypto.createDecipheriv(algorithm, legacyKeyB, iv);
                    let decB = decipherB.update(encryptedText, null, 'utf8');
                    decB += decipherB.final('utf8');
                    debugLog('Legacy Variation B SUCCESS.');
                    return decB;
                } catch (errB) {
                    debugLog(`Legacy Variation B FAILED: ${errB.message}`);
                }
            }

            // 5. Fallback Variation C: Raw Key as Hex (Common if key is 64 chars)
            if (rawKey.length === 64) {
                try {
                    const legacyKeyC = Buffer.from(rawKey, 'hex');
                    if (legacyKeyC.length === 32) {
                        const decipherC = crypto.createDecipheriv(algorithm, legacyKeyC, iv);
                        let decC = decipherC.update(encryptedText, null, 'utf8');
                        decC += decipherC.final('utf8');
                        debugLog('Legacy Variation C (Hex) SUCCESS.');
                        return decC;
                    }
                } catch (errC) {
                    debugLog(`Legacy Variation C FAILED: ${errC.message}`);
                }
            }

            debugLog('ALL decryption attempts FAILED.');
            return null;
        }
    } catch (globalErr) {
        debugLog(`Global Decryption ERROR: ${globalErr.message}`);
        return null;
    }
}

module.exports = { encrypt, decrypt };
