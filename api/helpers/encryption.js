const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Encrypts a string using a master key from environment variables.
 * @param {string} text - The text to encrypt.
 * @returns {string} - The encrypted string in the format: salt:iv:authTag:encryptedText
 */
function encrypt(text) {
    if (!text) return null;
    
    const masterKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-me-in-production';
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string previously encrypted with the encrypt function.
 * @param {string} encryptedData - The string in salt:iv:authTag:encryptedText format.
 * @returns {string} - The original decrypted text.
 */
function decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
        const parts = encryptedData.split(':');
        if (parts.length !== 4) {
            // Probably not encrypted or wrong format
            return encryptedData; 
        }
        
        const [saltHex, ivHex, authTagHex, encryptedText] = parts;
        const masterKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-me-in-production';
        
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        
        const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error.message);
        // If decryption fails, return the original data (might be old unencrypted data)
        return encryptedData;
    }
}

module.exports = { encrypt, decrypt };
