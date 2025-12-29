const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const ivLength = 16;

/**
 * Derives a consistent 32-byte key from the environment variable.
 * Fallback to a hardcoded string if ENV is missing.
 */
function getEncryptionKey() {
    const rawKey = process.env.ENCRYPTION_KEY || 'default_secret_key_at_least_32_chars_long_12345';
    // Hash to exactly 32 bytes to satisfy AES-256 requirement
    return crypto.createHash('sha256').update(String(rawKey)).digest();
}

const key = getEncryptionKey();
console.log('[Encryption] Derived Key Buffer Length:', key.length);

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
    if (!text || !text.includes(':')) {
        console.warn('[Encryption] Invalid encrypted text format (missing colon)');
        return null;
    }

    try {
        const parts = text.split(':');
        const ivHex = parts.shift();
        const encryptedHex = parts.join(':');

        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');

        // 1. Try with the primary (hashed) key
        try {
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            // When input is a Buffer, the second argument (input_encoding) should be null or omitted
            let decrypted = decipher.update(encryptedText, null, 'utf8');
            decrypted += decipher.final('utf8');
            console.log('[Encryption] Primary decryption successful.');
            return decrypted;
        } catch (primaryErr) {
            console.warn('[Encryption] Primary decryption failed:', primaryErr.message);

            // 2. Fallback: Try with the raw key (legacy method)
            const rawKey = process.env.ENCRYPTION_KEY || 'default_secret_key_at_least_32_chars_long_12345';

            // Variation A: Sliced/Padded buffer of raw string
            try {
                const legacyKeyA = Buffer.alloc(32);
                Buffer.from(String(rawKey)).copy(legacyKeyA);
                const decipherA = crypto.createDecipheriv(algorithm, legacyKeyA, iv);
                let decA = decipherA.update(encryptedText, null, 'utf8');
                decA += decipherA.final('utf8');
                console.log('[Encryption] Legacy Variation A successful.');
                return decA;
            } catch (errA) { }

            // Variation B: Just the first 32 chars of the string raw
            if (rawKey.length >= 32) {
                try {
                    const legacyKeyB = rawKey.substring(0, 32);
                    const decipherB = crypto.createDecipheriv(algorithm, legacyKeyB, iv);
                    let decB = decipherB.update(encryptedText, null, 'utf8');
                    decB += decipherB.final('utf8');
                    console.log('[Encryption] Legacy Variation B successful.');
                    return decB;
                } catch (errB) { }
            }

            // Variation C: Raw Key as Hex (Common if key is 64 chars)
            if (rawKey.length === 64) {
                try {
                    const legacyKeyC = Buffer.from(rawKey, 'hex');
                    if (legacyKeyC.length === 32) {
                        const decipherC = crypto.createDecipheriv(algorithm, legacyKeyC, iv);
                        let decC = decipherC.update(encryptedText, null, 'utf8');
                        decC += decipherC.final('utf8');
                        console.log('[Encryption] Legacy Variation C (Hex) successful.');
                        return decC;
                    }
                } catch (errC) { }
            }

            return null;
        }
    } catch (globalErr) {
        console.error('[Encryption] Global decryption error:', globalErr.message);
        return null;
    }
}

module.exports = { encrypt, decrypt };
