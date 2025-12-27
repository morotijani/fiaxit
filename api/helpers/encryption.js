const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY || 'default_secret_key_at_least_32_chars_long_12345', 'hex');
const ivLength = 16;

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
 * Decrypts text encrypted by the above function
 * @param {string} text iv:encryptedText
 * @returns {string} decryptedText
 */
function decrypt(text) {
    if (!text || !text.includes(':')) return null;
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encrypt, decrypt };
