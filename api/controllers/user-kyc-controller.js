const User = require('../models/user-model');
const UserKyc = require('../models/user-kyc-model');
const { v4: uuidv4 } = require('uuid');
const emailHelper = require('../helpers/email-helper');

class KYCController {

    submitKYC = () => {
        return async (req, res, next) => {
            try {
                const { kyc_id_type, kyc_id_number, address } = req.body;
                const userId = req.userData.user_id;

                // 1. Validate files
                if (!req.files || !req.files['document_front'] || !req.files['selfie']) {
                    return res.status(400).json({
                        success: false,
                        message: "KYC failed: Missing required documents (Front of ID and Selfie are required)."
                    });
                }

                // 2. Normalize and check files
                const docFront = req.files['document_front'][0].path.replace(/\\/g, "/");
                const docBack = req.files['document_back'] ? req.files['document_back'][0].path.replace(/\\/g, "/") : null;
                const selfie = req.files['selfie'][0].path.replace(/\\/g, "/");

                // 3. Find the user
                const user = await User.findOne({ where: { user_id: userId } });
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "KYC failed: User not found."
                    });
                }

                // 4. Validate metadata
                const requiredFields = ['kyc_id_type', 'kyc_id_number', 'address'];
                for (const field of requiredFields) {
                    if (!req.body[field]) {
                        return res.status(400).json({
                            success: false,
                            message: `KYC failed: Missing ${field}`
                        });
                    }
                }

                const addr = typeof address === 'string' ? JSON.parse(address) : address;

                // 5. Check existing KYC
                const existingKyc = await UserKyc.findOne({ where: { kyc_for: userId } });
                if (existingKyc && existingKyc.kyc_status !== 'rejected') {
                    return res.status(400).json({
                        success: false,
                        message: `KYC already submitted. Current status: ${existingKyc.kyc_status}`
                    });
                }

                // 6. Create or Update KYC Record
                const kycData = {
                    kyc_id: existingKyc ? existingKyc.kyc_id : uuidv4(),
                    kyc_for: userId,
                    kyc_id_type,
                    kyc_id_number,
                    kyc_document_front: docFront,
                    kyc_document_back: docBack,
                    kyc_selfie: selfie,
                    kyc_address: addr.kyc_address || null,
                    kyc_street: addr.kyc_street || null,
                    kyc_city: addr.kyc_city || null,
                    kyc_state: addr.kyc_state || null,
                    kyc_postal_code: addr.kyc_postal_code || null,
                    kyc_country: addr.kyc_country || null,
                    kyc_status: 'pending'
                };

                let kycRecord;
                if (existingKyc) {
                    kycRecord = await existingKyc.update(kycData);
                } else {
                    kycRecord = await UserKyc.create(kycData);
                }

                // 7. Update User model summary fields
                await user.update({
                    kyc_status: 'pending',
                    kyc_submitted_at: new Date()
                });

                // 8. Send Email
                await emailHelper.sendMail({
                    to: user.user_email,
                    subject: 'KYC Information Submitted | Fiaxit',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                            <h2 style="color: #0d6efd;">KYC Submission Received</h2>
                            <p>Hello ${user.user_fname},</p>
                            <p>We've received your KYC documents for verification. Our compliance team will review them shortly.</p>
                            <p><strong>Status:</strong> Pending Verification</p>
                            <p>You will receive another update once the review is completed.</p>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="font-size: 12px; color: #666;">If you didn't initiate this, please contact support.</p>
                        </div>
                    `
                }).catch(e => console.error("KYC Email Error:", e));

                return res.status(200).json({
                    success: true,
                    message: "KYC submitted successfully. Status set to Pending.",
                    data: { kyc_status: 'pending' }
                });
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    method: "submitKYC",
                    message: "An error occurred while submitting KYC information.",
                    details: error.message
                });
            }
        };
    };

    // Get KYC status
    getKYCStatus = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id;

                const user = await User.findOne({ where: { user_id: userId } });
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "User not found."
                    });
                }

                const userKyc = await UserKyc.findOne({ where: { kyc_for: userId } });
                if (!userKyc) {
                    return res.status(200).json({
                        success: true,
                        message: "KYC not submitted yet.",
                        kyc_status: "not_submitted"
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "KYC status retrieved successfully.",
                    kyc_status: userKyc.kyc_status,
                    kyc_submitted_at: userKyc.createdAt,
                    rejection_reason: userKyc.kyc_rejection_reason
                });
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    message: "An error occurred while retrieving KYC status."
                });
            }
        };
    };

    // Admin: List all pending KYC
    listPendingKYC = () => {
        return async (req, res, next) => {
            try {
                const pendingKyc = await UserKyc.findAll({
                    where: { kyc_status: 'pending' },
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['user_fname', 'user_lname', 'user_email']
                    }],
                    order: [['createdAt', 'DESC']]
                });

                return res.status(200).json({
                    success: true,
                    data: pendingKyc
                });
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch pending KYC."
                });
            }
        };
    };

    // Admin: Verify (Approve/Reject) KYC
    verifyKYC = () => {
        return async (req, res, next) => {
            try {
                const { userId } = req.params;
                const { status, reason, tier } = req.body;

                if (!['verified', 'rejected'].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid status. Use 'verified' or 'rejected'."
                    });
                }

                const user = await User.findOne({ where: { user_id: userId } });
                const kyc = await UserKyc.findOne({ where: { kyc_for: userId } });

                if (!user || !kyc) {
                    return res.status(404).json({
                        success: false,
                        message: "User or KYC record not found."
                    });
                }

                await kyc.update({
                    kyc_status: status,
                    kyc_rejection_reason: status === 'rejected' ? reason : null
                });

                await user.update({
                    kyc_status: status,
                    kyc_tier: status === 'verified' ? (tier || 2) : user.kyc_tier, // Use requested tier or default to 2
                    kyc_rejection_reason: status === 'rejected' ? reason : null
                });

                await emailHelper.sendMail({
                    to: user.user_email,
                    subject: `KYC Verification ${status === 'verified' ? 'Approved' : 'Rejected'} | Fiaxit`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                            <h2 style="color: ${status === 'verified' ? '#198754' : '#dc3545'};">
                                KYC Verification ${status === 'verified' ? 'Approved' : 'Rejected'}
                            </h2>
                            <p>Hello ${user.user_fname},</p>
                            <p>Your KYC verification request has been ${status === 'verified' ? 'approved' : 'rejected'}.</p>
                            ${status === 'rejected' ? `<p><strong>Reason:</strong> ${reason}</p>` : '<p>You now have full access to all platform features and higher transaction limits.</p>'}
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="font-size: 12px; color: #666;">Fiaxit Compliance Team</p>
                        </div>
                    `
                }).catch(e => console.error("KYC Result Email Error:", e));

                return res.status(200).json({
                    success: true,
                    message: `KYC ${status} successfully.`
                });
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    message: "Failed to process KYC verification."
                });
            }
        };
    };

}

module.exports = new KYCController();