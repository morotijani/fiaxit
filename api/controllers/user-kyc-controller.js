const User = require('../models/user-model');
const UserKyc = require('../models/user-kyc-model');
const { v4: uuidv4 } = require('uuid')
const nodemailer = require('nodemailer')

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
                const { kyc_id_type, kyc_id_number, kyc_document_front, kyc_document_back, kyc_selfie, address } = req.body; // Get address from request body
                const userId = req.userData.user_id; // Get user ID from auth middleware
                
                // Find the user
                const user = await User.findOne({
                    where: {
                        user_id: userId
                    }
                })

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        method: "submitKYC",
                        message: "KYC failed: User not found."
                    });
                }

                // Check if required KYC fields are provided
                // validate required fields
                const requiredFields = ['kyc_id_type', 'kyc_id_number', 'kyc_document_front', 'kyc_document_back', 'kyc_selfie', 'address'];
                for (const field of requiredFields) {
                    if (!req.body[field]) {
                        return res.status(400).json({
                            success: false, 
                            method: "submitKYC", 
                            message: `KYC failed: Missing required KYC information. Please provide the following: ${field}`
                        });
                    }
                }
                
                // Validate address if provided
                if (address) {
                    const requiredAddressFields = ['kyc_address', 'kyc_street', 'kyc_city', 'kyc_country'];
                    for (const field of requiredAddressFields) {
                        if (!address[field]) {
                            return res.status(400).json({
                                success: false,
                                method: "submitKYC",
                                message: `KYC failed: Missing required address information. Please provide the following: ${field}`
                            });
                        }
                    }
                }

                // check if user in the kyc table and merge it to user
                const userKyc = await UserKyc.findOne({ // get user
                    where: {
                        kyc_for : user.user_id
                    }
                })
                
                // Check if user already has KYC information
                if (userKyc && userKyc.kyc_status !== 'rejected') {
                    return res.status(400).json({
                        success: false, 
                        method: "submitKYC", 
                        message: `KYC failed: KYC verification is already submitted with status ${userKyc.kyc_status}. You cannot submit again.`
                    });
                }
                
                // In a production environment, you would:
                // 1. Upload documents to secure storage (AWS S3, etc.)
                // 2. Store document URLs rather than the actual documents

                // Create a new UserKyc record if one doesn't exist or if the previous one was rejected.
                const newKycRecord = await UserKyc.create({
                    kyc_id: uuidv4(), 
                    kyc_for: user.user_id, 
                    kyc_id_type: kyc_id_type, 
                    kyc_id_number: kyc_id_number, 
                    kyc_document_front: kyc_document_front, // In production, store URL instead
                    kyc_document_back: kyc_document_back,   // In production, store URL instead
                    kyc_selfie: kyc_selfie,                // In production, store URL instead
                    kyc_address: address ? address.kyc_address : null, 
                    kyc_street: address ? address.kyc_street : null, 
                    kyc_city: address ? address.kyc_city : null, 
                    kyc_state: address ? address.kyc_state : null || null, 
                    kyc_postal_code: address ? address.kyc_postal_code: null || null, 
                    kyc_country: address ? address.kyc_country : null,
                    kyc_status: 'pending'
                });

                if (!newKycRecord) {
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