const User = require('../models/user-model');
const KYCModel = require('../models/kyc-model')
const { v4: uuidv4 } = require('uuid')
const nodemailer = require('nodemailer')
const { Op } = require('sequelize');


// Configure email transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, 
    port: process.env.EMAIL_PORT, 
    secure: true, // true for port 465, false for other ports
    auth: {
        user: process.env.EMAIL_USERNAME, 
        pass: process.env.EMAIL_PASSWORD
    }
});

// Verify SMTP connection
transporter.verify((error, success) => {
    if (error) {
        console.log('SMTP server connection error:', error);
    } else {
        console.log('SMTP server connection successful');
    }
});

class KYCController {
    
    submitKYC = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id; // Get user ID from auth middleware
                
                // Find the user
                const user = await User.findOne({
                    where: {
                        user_id: userId
                    }
                });
                
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        method: "submitKYC",
                        message: "KYC failed: User not found."
                    });
                }

                
                
                // Check if required KYC fields are provided
                const {
                    idType,
                    idNumber,
                    documentFront,
                    documentBack,
                    selfie,
                    address
                } = req.body;
                
                if (!idType || !idNumber || !documentFront || !selfie) {
                    return res.status(400).json({
                        success: false,
                        method: "submitKYC",
                        message: "KYC failed: Missing required KYC information. Please provide idType, idNumber, documentFront, and selfie."
                    });
                }
                
                // Validate address if provided
                if (address && (!address.street || !address.city || !address.country)) {
                    return res.status(400).json({
                        success: false,
                        method: "submitKYC",
                        message: "KYC failed: Address information is incomplete. Please provide street, city, and country."
                    });
                }
                
                // Check if user already has KYC information
                if (user.kyc_status && user.kyc_status !== 'rejected') {
                    return res.status(400).json({
                        success: false,
                        method: "submitKYC",
                        message: `KYC failed: KYC verification is already ${user.kyc_status}. You cannot submit again.`
                    });
                }
                
                // In a production environment, you would:
                // 1. Upload documents to secure storage (AWS S3, etc.)
                // 2. Store document URLs rather than the actual documents
                // For this implementation, we'll assume document handling is done elsewhere
                
                // Store KYC information in the user record
                // Note: You'll need to add these fields to your User model
                user.kyc_id_type = idType;
                user.kyc_id_number = idNumber;
                user.kyc_document_front = documentFront; // In production, store URL instead
                user.kyc_document_back = documentBack; // In production, store URL instead
                user.kyc_selfie = selfie; // In production, store URL instead
                
                // Store address information
                if (address) {
                    user.kyc_address_street = address.street;
                    user.kyc_address_city = address.city;
                    user.kyc_address_state = address.state || null;
                    user.kyc_address_postal_code = address.postalCode || null;
                    user.kyc_address_country = address.country;
                }
                
                // Update KYC status
                user.kyc_status = 'pending';
                user.kyc_submitted_at = new Date();
                
                const insert = await user.save();

                if (!insert) {
                    return res.status(500).json({
                        success: false,
                        method: "submitKYC",
                        message: "KYC failed: Failed to submit KYC information."
                    });
                }

                // send user email on kyc submition
                const mailOptions = {
                    from: "Fiaxit 👻" + process.env.EMAIL_USERNAME, 
                    to: user.user_email, 
                    subject: 'KYC Information Submitted', 
                    html:  `
                        <h1>KYC Information Submitted</h1>
                        <p>Dear ${user.user_fname} ${user.user_lname},</p>
                        <p>Thank you for submitting your KYC information. Your application is currently under review.</p>
                        <p>You will receive an email notification once your verification is complete.</p>
                        <p>Sincerely,<br>The Fiaxit Team</p>
                    `
                }

                await transporter.sendMail(mailOptions);
                
                return res.status(200).json({
                    success: true,
                    method: "submitKYC",
                    message: "KYC information submitted successfully. Your verification is pending review."
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
        }
    }

    // Get KYC status
    getKYCStatus = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id; // Get user ID from auth middleware
                
                // Find the user
                const user = await User.findOne({
                    where: {
                        user_id: userId
                    }
                });
                
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        method: "getKYCStatus",
                        message: "User not found."
                    });
                }
                
                // Check if user has submitted KYC
                if (!user.kyc_status) {
                    return res.status(200).json({
                        success: true,
                        method: "getKYCStatus",
                        message: "KYC not submitted yet.", 
                        kyc_status: "not_submitted"
                    });
                }
                
                // Return KYC status
                return res.status(200).json({
                    success: true,
                    method: "getKYCStatus",
                    message: "KYC status retrieved successfully.",
                    kyc_status: user.kyc_status,
                    kyc_submitted_at: user.kyc_submitted_at // Include submission date
                });
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    method: "getKYCStatus",
                    message: "An error occurred while retrieving KYC status.",
                    details: error.message
                });
            }
        }
    }

}

module.exports = new KYCController() // instantiate class and add to module so that we can use it anywhere else