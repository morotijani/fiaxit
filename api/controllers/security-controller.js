const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/user-model');
const WhitelistedAddress = require('../models/whitelisted-address-model');
const Session = require('../models/session-model');
const { encrypt, decrypt } = require('../helpers/encryption');
const { v4: uuidv4 } = require('uuid');

class SecurityController {
    // 1. Setup 2FA: Generate secret and return QR code
    setup2FA = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const user = await User.findOne({ where: { user_id: userId } });

                if (!user) {
                    return res.status(404).json({ success: false, message: "User not found." });
                }

                // Generate a temporary secret
                const secret = speakeasy.generateSecret({
                    name: `Fiaxit (${user.user_email})`,
                    issuer: 'Fiaxit'
                });

                // Generate QR code data URL
                const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

                // Store encrypted secret temporarily or just return it to be sent back for verification
                // For better security, we'll store it in the user model as "pending"
                // but since we only have one field, we'll just return it and the user must verify it to save.

                res.status(200).json({
                    success: true,
                    data: {
                        secret: secret.base32,
                        qrCode: qrCodeUrl,
                        otpauth_url: secret.otpauth_url
                    }
                });
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to setup 2FA.", error: error.message });
            }
        };
    }

    // 2. Verify and Enable 2FA
    enable2FA = () => {
        return async (req, res) => {
            try {
                const { secret, token } = req.body;
                const userId = req.userData.user_id;

                if (!secret || !token) {
                    return res.status(400).json({ success: false, message: "Secret and token are required." });
                }

                const verified = speakeasy.totp.verify({
                    secret: secret,
                    encoding: 'base32',
                    token: token
                });

                if (verified) {
                    const user = await User.findOne({ where: { user_id: userId } });
                    user.user_2fa_secret = encrypt(secret);
                    user.user_2fa_enabled = true;
                    await user.save();

                    res.status(200).json({
                        success: true,
                        message: "Two-factor authentication enabled successfully."
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        message: "Invalid verification code. Please try again."
                    });
                }
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to enable 2FA.", error: error.message });
            }
        };
    }

    // 3. Disable 2FA
    disable2FA = () => {
        return async (req, res) => {
            try {
                const { token } = req.body;
                const userId = req.userData.user_id;

                const user = await User.findOne({ where: { user_id: userId } });
                if (!user.user_2fa_enabled) {
                    return res.status(400).json({ success: false, message: "2FA is already disabled." });
                }

                const secret = decrypt(user.user_2fa_secret);
                const verified = speakeasy.totp.verify({
                    secret: secret,
                    encoding: 'base32',
                    token: token
                });

                if (verified) {
                    user.user_2fa_secret = null;
                    user.user_2fa_enabled = false;
                    await user.save();

                    res.status(200).json({
                        success: true,
                        message: "Two-factor authentication disabled successfully."
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        message: "Invalid verification code."
                    });
                }
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to disable 2FA.", error: error.message });
            }
        };
    }

    // 4. Verify 2FA token (Internal helper for login/transactions)
    verifyToken = (userSecret, token) => {
        try {
            const secret = decrypt(userSecret);
            return speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: token
            });
        } catch (e) {
            return false;
        }
    }

    // --- Whitelisting Logic ---

    getWhitelistedAddresses = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const addresses = await WhitelistedAddress.findAll({ where: { user_id: userId } });
                res.status(200).json({ success: true, data: addresses });
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to fetch addresses.", error: error.message });
            }
        };
    }

    addWhitelistedAddress = () => {
        return async (req, res) => {
            try {
                const { address, coin_symbol, label } = req.body;
                const userId = req.userData.user_id;

                if (!address || !coin_symbol) {
                    return res.status(422).json({ success: false, message: "Address and coin symbol are required." });
                }

                // Basic Backend Validation (mirroring frontend)
                const symbol = coin_symbol.toUpperCase();
                let isValid = true;
                if (symbol === 'BTC') {
                    isValid = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,65})$/.test(address);
                } else if (symbol === 'ETH') {
                    isValid = /^0x[a-fA-F0-9]{40}$/.test(address);
                } else if (symbol === 'USDT') {
                    isValid = /^(0x[a-fA-F0-9]{40}|T[1-9A-HJ-NP-Za-km-z]{33})$/.test(address);
                }

                if (!isValid) {
                    return res.status(422).json({ success: false, message: `Invalid ${symbol} address format.` });
                }

                const newAddr = await WhitelistedAddress.create({
                    address_id: uuidv4(),
                    user_id: userId,
                    coin_symbol: symbol,
                    address,
                    label
                });

                res.status(201).json({ success: true, message: "Address added to whitelist.", data: newAddr });
            } catch (error) {
                console.error("Whitelist add error:", error);
                res.status(500).json({ success: false, message: "Failed to add address.", error: error.message });
            }
        };
    }

    removeWhitelistedAddress = () => {
        return async (req, res) => {
            try {
                const { id } = req.params;
                const userId = req.userData.user_id;

                const deleted = await WhitelistedAddress.destroy({ where: { address_id: id, user_id: userId } });
                if (deleted) {
                    res.status(200).json({ success: true, message: "Address removed." });
                } else {
                    res.status(404).json({ success: false, message: "Address not found." });
                }
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to remove address.", error: error.message });
            }
        };
    }

    toggleWhitelisting = () => {
        return async (req, res) => {
            try {
                const { enabled } = req.body;
                const userId = req.userData.user_id;

                const user = await User.findOne({ where: { user_id: userId } });
                user.user_whitelisting_enabled = !!enabled;
                await user.save();

                res.status(200).json({ success: true, message: `Whitelisting ${enabled ? 'enabled' : 'disabled'} successfully.` });
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to update whitelisting status.", error: error.message });
            }
        };
    }

    // --- Session Management ---

    getSessions = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const sessions = await Session.findAll({
                    where: { user_id: userId },
                    order: [['last_active', 'DESC']]
                });
                res.status(200).json({ success: true, data: sessions });
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to fetch sessions.", error: error.message });
            }
        };
    }

    revokeSession = () => {
        return async (req, res) => {
            try {
                const { id } = req.params;
                const userId = req.userData.user_id;

                const deleted = await Session.destroy({ where: { session_id: id, user_id: userId } });
                if (deleted) {
                    res.status(200).json({ success: true, message: "Session revoked." });
                } else {
                    res.status(404).json({ success: false, message: "Session not found." });
                }
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to revoke session.", error: error.message });
            }
        };
    }

    // --- Anti-Phishing Logic ---

    setAntiPhishingCode = () => {
        return async (req, res) => {
            try {
                const { code } = req.body;
                const userId = req.userData.user_id;

                const user = await User.findOne({ where: { user_id: userId } });
                user.user_anti_phishing_code = code || null;
                await user.save();

                res.status(200).json({ success: true, message: "Anti-phishing code updated successfully." });
            } catch (error) {
                res.status(500).json({ success: false, message: "Failed to update anti-phishing code.", error: error.message });
            }
        };
    }
}

module.exports = new SecurityController();
