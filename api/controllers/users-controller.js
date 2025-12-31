const User = require('../models/user-model');
const UserForgetPassword = require('../models/user-forget-password-model')
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const { blacklistToken } = require('../middleware/check-auth');
const nodemailer = require('nodemailer')
const crypto = require('crypto')
const { Op } = require('sequelize');
const { timeStamp } = require('console');
const UserKyc = require('../models/user-kyc-model');
const emailHelper = require('../helpers/email-helper');
const Notification = require('../models/notification-model');
const SecurityController = require('./security-controller');
const PortfolioController = require('./portfolio-controller');
const Session = require('../models/session-model');
const fs = require('fs');
const path = require('path');


// Store verification codes temporarily (in production, use Redis or similar)
const verificationCodes = new Map();

class UsersController {

    signup = () => {
        return async (req, res, next) => {
            try {
                const userId = uuidv4() + '-' + Date.now(); // Generate a unique user ID
                const vericode = uuidv4() + '-' + Date.now(); // Generate a random code for email verification code
                // const vericode = Math.floor(100000 + Math.random() * 900000); // generate a random 6-digit code

                // check if email is a valid email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(req.body.email)) {
                    return res.status(422).json({
                        success: false,
                        method: "registerUser",
                        path: "email",
                        message: "User registration failed: Please enter a valid email address."
                    });
                }

                // check if email already exist
                const isEmailExist = await User.findOne({
                    where: {
                        user_email: req.body.email
                    }
                })

                if (isEmailExist) {
                    return res.status(401).json({
                        success: false,
                        method: "registerUser",
                        path: "email",
                        message: "User registration failed: Email already exist."
                    })
                }

                // check if phone number already exist
                if (req.body.phone) {
                    const isPhoneExist = await User.findOne({
                        where: {
                            user_phone: req.body.phone
                        }
                    })

                    if (isPhoneExist) {
                        return res.status(401).json({
                            success: false,
                            method: "registerUser",
                            path: "phone",
                            message: "User registration failed: Phone number already exist."
                        })
                    }
                }

                // check for password length and characters
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
                if (!passwordRegex.test(req.body.password)) {
                    return res.status(422).json({
                        success: false,
                        method: "registerUser",
                        path: "password",
                        message: "User registration failed: Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
                    });
                }

                // check if password and confirm password is equal
                if (req.body.password !== req.body.confirm_password) {
                    return res.status(422).json([
                        {
                            path: "password",
                            message: "User registration failed: Passwords do not match."
                        },
                        {
                            path: "confirm_password",
                            message: "User registration failed: Passwords do not match."
                        }
                    ])
                }

                // check if pin is number and its length is 4
                if (isNaN(req.body.pin) || req.body.pin.toString().length !== 4) {
                    return res.status(422).json({
                        success: false,
                        method: "registerUser",
                        path: "pin",
                        message: "PIN must be a 4-digit number."
                    });
                }

                const user = await User.create({
                    user_id: userId,
                    user_fname: req.body.fname,
                    user_mname: req.body.mname || null, // if middle name is not provided, set to null
                    user_lname: req.body.lname,
                    user_email: req.body.email,
                    user_phone: req.body.phone || null, // if phone is not provided, set to null
                    user_password: req.body.password,
                    user_pin: req.body.pin,
                    user_vericode: vericode,
                    user_invitationcode: req.body.invitationcode || null // if invitation code is not provided, set to null
                })

                if (!user) {
                    return res.status(422).json({
                        success: false,
                        method: "registerUser",
                        message: "User registration failed: An error occured while registering user.",
                    })
                }

                // send mail to user email to verify their account
                const verifyUrl = `http://sites.local:3000/auth/verify/${userId}/${vericode}`;
                const mailOptions = {
                    from: `"Fiaxit" <${process.env.EMAIL_USERNAME}>`,
                    to: req.body.email,
                    subject: 'Verify your Fiaxit Account',
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
                            <div style="text-align: center; padding: 20px 0;">
                                <h1 style="color: #0d6efd; margin: 0; font-size: 28px; letter-spacing: -1px;">Fiaxit</h1>
                            </div>
                            <div style="background-color: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                <h2 style="margin-top: 0; color: #1a202c;">Hello ${req.body.fname},</h2>
                                <p style="font-size: 16px;">Welcome to Fiaxit! We're excited to have you on board. To get started, please verify your email address by clicking the button below:</p>
                                
                                <div style="text-align: center; margin: 35px 0;">
                                    <a href="${verifyUrl}" style="background-color: #0d6efd; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Verify My Account</a>
                                </div>
                                
                                <p style="font-size: 14px; color: #64748b;">This link will expire in <strong>15 minutes</strong> for your security.</p>
                                
                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
                                
                                <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">If you didn't create a Fiaxit account, you can safely ignore this email.</p>
                                <p style="font-size: 13px; color: #94a3b8; margin-top: 5px;">Or copy and paste this link: <br> <a href="${verifyUrl}" style="color: #0d6efd; word-break: break-all;">${verifyUrl}</a></p>
                            </div>
                            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
                                &copy; ${new Date().getFullYear()} Fiaxit. All rights reserved.
                            </div>
                        </div>
                    `
                };

                // Send the email using the helper
                await emailHelper.sendMail(mailOptions).catch(err => console.error('Signup email error:', err));

                res.status(200).json({
                    success: true,
                    method: "registerUser",
                    data: user,
                    timeStamp: new Date().toISOString()
                })
            } catch (error) {
                console.error('Error in register user:', error)
                res.status(422).json({
                    success: false,
                    method: "registerUser",
                    message: "Registration failed: An error occured while registering user.",
                    details: error.message
                })
            }
        }
    }

    // verify user account
    verify = () => {
        return async (req, res, next) => {
            try {
                const uid = req.params.id;
                const code = req.params.code
                let response = {}

                // check if user id exist 
                const user = await User.findOne({
                    where: {
                        user_id: uid
                    }
                })

                if (!user) {
                    return res.status(400).json({
                        success: false,
                        method: "verifyUser",
                        status: "invalid_user",
                        message: "Verification failed: User not found"
                    })
                }

                // check if code provided exist and if it tallys with user data
                if (user.user_vericode !== code) {
                    return res.status(400).json({
                        success: false,
                        method: "verifyUser",
                        status: "invalid_code",
                        message: "Verification failed: Invalid verification code"
                    })
                }

                // check if verification code is expired by using the time account was created and the next 15 min
                const createdAt = new Date(user.createdAt);
                const now = new Date();
                const diffMinutes = Math.floor((now - createdAt) / 1000 / 60); // time difference in minutes

                if (diffMinutes > 15) {
                    return res.status(400).json({
                        success: false,
                        method: "verifyUser",
                        status: "expired",
                        message: "Verification failed: Verification code has expired"
                    })
                }

                // check if user is already verified
                if (user.user_verified) {
                    return res.status(400).json({
                        success: false,
                        method: "verifyUser",
                        status: "is_verified",
                        message: "Verification failed: You are already verified"
                    })
                }

                // update user data
                user.user_verified = true
                user.kyc_tier = 1 // Email verified Tier
                const save = user.save({
                    where: {
                        user_id: uid
                    }
                })

                if (!save) {
                    return res.status(500).json({
                        success: false,
                        method: "verifyUser",
                        status: "network_error",
                        message: "Verification failed: An error occured while verifying user.",
                    })
                }

                // send welcome email to user
                const mailOptions = {
                    from: `"Fiaxit" <${process.env.EMAIL_USERNAME}>`,
                    to: user.user_email,
                    subject: 'Welcome to Fiaxit!',
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
                            <div style="text-align: center; padding: 20px 0;">
                                <h1 style="color: #0d6efd; margin: 0; font-size: 28px; letter-spacing: -1px;">Fiaxit</h1>
                            </div>
                            <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); text-align: center;">
                                <div style="margin-bottom: 25px;">
                                    <span style="background-color: #d1e7dd; color: #0f5132; padding: 10px 20px; border-radius: 30px; font-size: 14px; font-weight: bold;">Account Verified</span>
                                </div>
                                <h2 style="margin-top: 0; color: #1a202c;">Welcome, ${user.user_fname}!</h2>
                                <p style="font-size: 16px; color: #4a5568;">Your account is now fully active. We're thrilled to have you as part of the Fiaxit community.</p>
                                
                                <div style="margin: 35px 0;">
                                    <a href="http://sites.local:3000/auth/login" style="background-color: #0d6efd; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Login to Dashboard</a>
                                </div>
                                
                                <p style="font-size: 14px; color: #64748b;">Start exploring our features and manage your digital assets with confidence.</p>
                                
                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                                
                                <p style="font-size: 13px; color: #94a3b8; margin-top: 5px;">If you have any questions, our support team is always here to help.</p>
                            </div>
                            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
                                &copy; ${new Date().getFullYear()} Fiaxit. All rights reserved.
                            </div>
                        </div>
                    `
                };

                await emailHelper.sendMail(mailOptions).catch(err => console.error('Welcome email error:', err));

                res.status(200).json({
                    success: true,
                    method: "verifyUser",
                    message: "User verified successfully.",
                    status: "verified",
                    timeStamp: new Date().toISOString()
                })
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    method: "verifyUser",
                    message: "Verification failed: An error occured while verifying user.",
                    details: error.message
                })
            }
        }
    }

    // login user
    login = () => {
        return async (req, res, next) => {
            try {
                const msg = "Something is wrong with your email or password";
                const errors = [
                    {
                        path: "password",
                        message: msg,
                    },
                    {
                        path: "email",
                        message: msg
                    }
                ]
                const resp = { success: false, method: "login", errors: errors }
                const user = await User.findOne({
                    where: {
                        user_email: req.body.email
                    }
                })
                const password = req.body.password
                if (user) {
                    const passed = await bcrypt.compare(password, user.user_password)
                    if (passed) {
                        // check if user is verified or not
                        if (!user.user_verified) {
                            return res.status(401).json({
                                success: false,
                                method: "login",
                                path: "email",
                                message: "User login failed: User not verified, please verify your account."
                            })
                        }

                        // Check for 2FA
                        if (user.user_2fa_enabled) {
                            return res.status(200).json({
                                success: true,
                                method: "userLogin",
                                requires_2fa: true,
                                temp_user_id: user.user_id, // so frontend knows which user to verify
                                message: "Two-factor authentication required."
                            });
                        }

                        const signVals = user.toJSON(); //
                        delete signVals.password // remove password from the signvals
                        const token = await jwt.sign(signVals, process.env.JWT_KEY, {
                            expiresIn: "7d"
                        });

                        // 3. Create Session Record
                        await Session.create({
                            session_id: uuidv4(),
                            user_id: user.user_id,
                            ip_address: req.ip,
                            user_agent: req.headers['user-agent'],
                            device_name: req.headers['user-agent'].split(')')[0].split('(')[1] || 'Unknown Device'
                        });

                        // send email to log in user

                        // send login notification email
                        const mailOptions = {
                            from: `"Fiaxit Security" <${process.env.EMAIL_USERNAME}>`,
                            to: req.body.email,
                            subject: 'Login Notification | Fiaxit',
                            html: `
                                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
                                    <div style="text-align: center; padding: 20px 0;">
                                        <h1 style="color: #0d6efd; margin: 0; font-size: 28px; letter-spacing: -1px;">Fiaxit</h1>
                                        ${emailHelper.getAntiPhishingBadge(user.user_anti_phishing_code)}
                                    </div>
                                    <div style="background-color: #ffffff; border-radius: 12px; padding: 35px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                        <h2 style="margin-top: 0; color: #1a202c; font-size: 22px;">New Sign-in Detected</h2>
                                        <p style="font-size: 16px; color: #4a5568;">Hello ${user.user_fname}, we detected a recent sign-in to your Fiaxit Account.</p>
                                        
                                        <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0; border: 1px solid #edf2f7;">
                                            <h3 style="margin-top: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 15px;">Sign-in Details</h3>
                                            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                                <tr>
                                                    <td style="padding: 8px 0; color: #718096; width: 100px;">IP Address</td>
                                                    <td style="padding: 8px 0; color: #2d3748; font-weight: 500;">${req.ip}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #718096;">Device</td>
                                                    <td style="padding: 8px 0; color: #2d3748; font-weight: 500;">${req.headers['user-agent'].split(')')[0].split('(')[1] || 'Unknown Device'}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #718096;">Browser</td>
                                                    <td style="padding: 8px 0; color: #2d3748; font-weight: 500;">${req.headers['user-agent'].split(' ').pop()}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0; color: #718096;">Time</td>
                                                    <td style="padding: 8px 0; color: #2d3748; font-weight: 500;">${new Date().toUTCString()}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        
                                        <p style="font-size: 14px; color: #e53e3e; background-color: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #f56565;">
                                            <strong>Not you?</strong> If you did not initiate this sign-in, please <a href="http://sites.local:3000/support" style="color: #e53e3e; text-decoration: underline;">contact our support team</a> immediately to secure your account.
                                        </p>
                                        
                                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                                        <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">Thank you for using Fiaxit 👻.</p>
                                    </div>
                                    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
                                        &copy; ${new Date().getFullYear()} Fiaxit. All rights reserved.
                                    </div>
                                </div>
                            `
                        };

                        // Send the email notification
                        await emailHelper.sendMail(mailOptions).catch(err => console.error('Login email error:', err));

                        // Trigger Balance Snapshot
                        PortfolioController._takeSnapshotInternal(user.user_id, signVals);

                        resp.success = true;
                        resp.method = "userLogin";
                        resp.errors = [];
                        resp.token = token;
                        resp.timeStamp = new Date().toISOString();
                    }
                } else {
                    return res.status(401).json({
                        success: false,
                        method: "userLogin",
                        path: "email",
                        message: "User login failed: User not found."
                    })
                }
                res.status(200).json(resp)
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    method: "userLogin",
                    message: "User login failed: An error occurred while logging in the user.",
                    details: error.message
                });
            }
        }
    }

    // verify 2FA during login
    verifyLogin2FA = () => {
        return async (req, res) => {
            try {
                const { user_id, token } = req.body;
                if (!user_id || !token) {
                    return res.status(400).json({ success: false, message: "User ID and token are required." });
                }

                const user = await User.findOne({ where: { user_id } });
                if (!user) {
                    return res.status(404).json({ success: false, message: "User not found." });
                }

                const verified = SecurityController.verifyToken(user.user_2fa_secret, token);

                if (verified) {
                    const signVals = user.toJSON();
                    delete signVals.user_password;
                    delete signVals.user_2fa_secret;

                    const jwtToken = await jwt.sign(signVals, process.env.JWT_KEY, {
                        expiresIn: "7d"
                    });

                    // Create Session Record
                    await Session.create({
                        session_id: uuidv4(),
                        user_id: user.user_id,
                        ip_address: req.ip,
                        user_agent: req.headers['user-agent'],
                        device_name: req.headers['user-agent'].split(')')[0].split('(')[1] || 'Unknown Device'
                    });

                    // Trigger Balance Snapshot
                    PortfolioController._takeSnapshotInternal(user.user_id, signVals);

                    res.status(200).json({
                        success: true,
                        method: "verifyLogin2FA",
                        token: jwtToken,
                        timeStamp: new Date().toISOString()
                    });
                } else {
                    res.status(401).json({
                        success: false,
                        method: "verifyLogin2FA",
                        message: "Invalid 2FA code."
                    });
                }
            } catch (error) {
                res.status(500).json({
                    success: false,
                    method: "verifyLogin2FA",
                    message: "Verification failed.",
                    details: error.message
                });
            }
        };
    }

    resendVericode = () => {
        return async (req, res, next) => {
            try {
                const email = req.body.email;
                const vericode = uuidv4(); // generate verification code

                // check if email is a valid emailaddress
                if (!email) {
                    return res.status(400).json({
                        success: false,
                        method: "resendVericode",
                        message: "Resend verification failed: Email is not provided."
                    });
                }

                // check if email is a valid emailaddress
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    return res.status(400).json({
                        success: false,
                        method: "resendVericode",
                        message: "Resend verification failed: Email is not valid."
                    });
                }

                // check if email exist
                const user = await User.findOne({
                    where: {
                        user_email: email
                    }
                });

                // check if user is already verified
                if (user && user.user_verified) {
                    return res.status(400).json({
                        success: false,
                        method: "resendVericode",
                        message: "Resend verification failed: User is already verified."
                    });
                }

                if (!user) {
                    return res.status(400).json({
                        success: false,
                        method: "resendVericode",
                        message: "Resend verification failed: User not found."
                    });
                }

                // update user's verification code
                await User.update({
                    user_vericode: vericode
                }, {
                    where: {
                        user_email: email
                    }
                });

                // send verification link to user
                const verifyUrl = `http://sites.local:3000/auth/verify/${user.user_id}/${vericode}`;
                const mailOptions = {
                    from: `"Fiaxit" <${process.env.EMAIL_USERNAME}>`,
                    to: email,
                    subject: "Verify your Fiaxit Account",
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
                            <div style="text-align: center; padding: 20px 0;">
                                <h1 style="color: #0d6efd; margin: 0; font-size: 28px; letter-spacing: -1px;">Fiaxit</h1>
                            </div>
                            <div style="background-color: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                <h2 style="margin-top: 0; color: #1a202c;">Hello ${user.user_fname},</h2>
                                <p style="font-size: 16px;">You requested a new verification link for your Fiaxit account. Please click the button below to confirm your email address:</p>
                                
                                <div style="text-align: center; margin: 35px 0;">
                                    <a href="${verifyUrl}" style="background-color: #0d6efd; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">Verify My Account</a>
                                </div>
                                
                                <p style="font-size: 14px; color: #64748b;">This link will expire in <strong>15 minutes</strong> for your security.</p>
                                
                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
                                
                                <p style="font-size: 13px; color: #94a3b8; margin-bottom: 0;">If you didn't request this link, you can safely ignore this email.</p>
                                <p style="font-size: 13px; color: #94a3b8; margin-top: 5px;">Or copy and paste this link: <br> <a href="${verifyUrl}" style="color: #0d6efd; word-break: break-all;">${verifyUrl}</a></p>
                            </div>
                            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
                                &copy; ${new Date().getFullYear()} Fiaxit. All rights reserved.
                            </div>
                        </div>
                    `
                };

                try {
                    await emailHelper.sendMail(mailOptions);
                    return res.status(200).json({
                        success: true,
                        method: "resendVericode",
                        message: "Verification link sent successfully.",
                        timeStamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.log('Resend email error:', error);
                    return res.status(500).json({
                        success: false,
                        method: "resendVericode",
                        message: "Resend verification failed: Email sending error."
                    });
                }
            } catch (error) {
                console.error('Error in resend verification code:', error);
                return res.status(500).json({
                    success: false,
                    method: "resendVericode",
                    message: "Resend verification failed: Internal server error.",
                    details: error.message
                });
            }
        }
    }

    logout = () => {
        return async (req, res, next) => {
            try {
                const token = req.token;
                if (!token) {
                    return res.status(401).json({
                        success: false,
                        method: "userLogout",
                        message: "User logout failed: No authentication token provided."
                    });
                }

                const blacklisted = await blacklistToken(token);
                if (blacklisted) {
                    res.status(200).json({
                        success: true,
                        method: "userLogout",
                        message: "User logout successful: Token blacklisted. User has been logged out.",
                        timeStamp: new Date().toISOString()
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        method: "userLogout",
                        message: "User logout failed (Could not blacklist token): An error occurred while logging out the user."
                    });
                }
            } catch (error) {
                res.status(500).json({
                    success: false,
                    method: "userLogout",
                    message: "User logout failed: An error occurred while logging out the user.",
                    error: error.message
                });
            }
        }
    }

    uploadProfileImage = () => {
        return async (req, res, next) => {
            try {
                if (!req.file) {
                    return res.status(400).json({
                        success: false,
                        message: "No file uploaded."
                    });
                }

                const userId = req.userData.user_id;
                const imagePath = req.file.path.replace(/\\/g, "/");

                // Get current user to check for old image
                const user = await User.findOne({ where: { user_id: userId } });
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "User not found."
                    });
                }

                // Delete old image if it exists
                if (user.user_image) {
                    const oldImagePath = path.join(__dirname, '..', '..', user.user_image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                        console.log('Deleted old profile image:', user.user_image);
                    }
                }

                await user.update({
                    user_image: imagePath
                });

                res.status(200).json({
                    success: true,
                    message: "Profile image uploaded successfully.",
                    data: {
                        user: await this.formatUserResponse(user, req)
                    }
                });
            } catch (error) {
                console.error("Profile image upload error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to upload profile image.",
                    error: error.message
                });
            }
        }
    }

    update = () => {
        return async (req, res, next) => {
            try {
                const resp = {
                    success: false,
                    user: null
                };
                const userId = req.params.id;
                // check to see if user is updating not him/herself
                if (userId != req.userData.user_id) {
                    return res.status(401).json({
                        success: false,
                        method: "updateUser",
                        message: "You do not have permission to update this user."
                    })
                }
                const user = await User.findOne({
                    where: {
                        user_id: userId
                    }
                })
                // const user = await User.findByPk(userId) // find by using primary key
                if (user) {
                    user.user_fname = req.body.fname || user.user_fname
                    user.user_mname = req.body.mname || user.user_mname
                    user.user_lname = req.body.lname || user.user_lname
                    user.user_email = req.body.email || user.user_email
                    user.user_phone = req.body.phone || user.user_phone
                    user.user_dob = req.body.dob || user.user_dob
                    user.user_gender = req.body.gender || user.user_gender
                    user.user_image = req.body.user_image || user.user_image
                    if (req.body.password) {
                        user.updatePassword = true
                        user.user_password = req.body.password
                    }
                    if (req.body.pin) {
                        user.updatePin = true;
                        user.user_pin = req.body.pin
                    }
                    user.user_invitationcode = req.body.invitationcode || null
                    await user.save();
                    await user.reload();
                    resp.success = true;
                    resp.method = "updateUser";
                    resp.data = { user: await this.formatUserResponse(user, req) }
                }
                res.status(200).json(resp)
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    method: 'updateUser',
                    message: "An error occured on updating user.",
                    details: error.message
                })
            }
        }
    }

    loggedInUser = () => {
        return async (req, res, next) => {
            try {
                const resp = {
                    success: false,
                    method: "loggedInUser",
                    data: { user: null },
                    message: "Logged in user failed: User not found."
                }

                resp.success = true;
                resp.method = "loggedInUser";
                resp.message = "User is logged in.";
                resp.data = await this.formatUserResponse(req.userData, req);
                resp.timeStamp = new Date().toISOString();

                res.status(200).json(resp);
            } catch (error) {
                res.status(401).json({
                    success: false,
                    method: "loggedInUser",
                    message: "An error occurred while fetching logged in user.",
                    details: error.message
                });
            }
        }
    }

    // Forget password
    forgetPassword = () => {
        return async (req, res, next) => {
            try {
                const { email } = req.body

                if (!email) {
                    return res.status(401).json({
                        success: false,
                        method: 'userForgetPassword',
                        path: "email",
                        message: 'Missing required parameters: Email is required.'
                    })
                }

                const user = await User.findOne({
                    where: {
                        user_email: email
                    }
                })

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        method: "userForgetPassword",
                        path: "email",
                        message: "Forget Password failed: User email not found.",
                    })
                }
                // const code = this.generateVerificationCode();
                // Generate a random 6-digit verification code
                const verificationCode = crypto.randomInt(100000, 999999).toString();

                // Store the verification code in the map with the user's email as the key
                verificationCodes.set(email, {
                    code: verificationCode,
                    expiresAt: Date.now() + 15 * 60 * 1000 // 10 minutes from now
                })

                // Send verification code via email
                const mailOptions = {
                    from: `"Fiaxit Security" <${process.env.EMAIL_USERNAME}>`,
                    to: email,
                    subject: 'Password Reset Verification Code - Fiaxit',
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
                            <div style="text-align: center; padding: 20px 0;">
                                <h1 style="color: #0d6efd; margin: 0; font-size: 28px; letter-spacing: -1px;">Fiaxit</h1>
                            </div>
                            <div style="background-color: #ffffff; border-radius: 12px; padding: 35px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                <h2 style="margin-top: 0; color: #1a202c; font-size: 22px; text-align: center;">Reset Your Password</h2>
                                <p style="font-size: 16px; color: #4a5568; text-align: center;">Hello, you requested a password reset for your Fiaxit account. Please use the verification code below to proceed:</p>
                                
                                <div style="background-color: #f8fafc; border-radius: 10px; padding: 30px; margin: 25px 0; border: 1px solid #edf2f7; text-align: center;">
                                    <div style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Verification Code</div>
                                    <div style="font-size: 36px; font-weight: 800; color: #0d6efd; letter-spacing: 8px;">${verificationCode}</div>
                                </div>
                                
                                <p style="font-size: 14px; color: #64748b; text-align: center; margin-bottom: 0;">This code will expire in <strong>15 minutes</strong>.</p>
                                
                                <p style="font-size: 14px; color: #e53e3e; background-color: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #f56565; margin-top: 25px;">
                                    <strong>Security Notice:</strong> If you did not request this code, your account may be at risk. Please ignore this email and secure your account.
                                </p>
                                
                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                                <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">Thank you for choosing Fiaxit.</p>
                            </div>
                            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
                                &copy; ${new Date().getFullYear()} Fiaxit. All rights reserved.
                            </div>
                        </div>
                    `
                }

                // Send the email
                await emailHelper.sendMail(mailOptions);

                // inset into forget password table
                const insert = await UserForgetPassword.create({
                    password_reset_id: '',
                    password_reset_user_id: user.user_id,
                    password_reset_token: verificationCode,
                    password_reset_expires: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
                });

                return res.status(201).json({
                    success: true,
                    method: "userForgetPassword",
                    message: "Forget password verification code sent to your email.",
                    data: {
                        insert
                    }
                })
            } catch (error) {
                console.error('Error in forget password:', error)
                return res.status(500).json({
                    success: false,
                    method: "userForgetPassword",
                    message: "Forget password failed: Error while creating forget password code.",
                    details: error.message
                })
            }
        }
    }

    verifyResetCode = () => {
        return async (req, res, next) => {
            try { // working here
                const { email, code } = req.body;

                if (!email || !code) {
                    return res.status(400).json({
                        success: false,
                        method: "verifyResetCode",
                        message: "Missing required parameters: Email and verification code are required."
                    });
                }

                // Find the user
                const user = await User.findOne({
                    where: {
                        user_email: email
                    }
                });

                if (!user) {
                    return res.status(404).json({
                        status: false,
                        method: "verifyResetCode",
                        message: "Verify reset code failed: User not found.",
                    })
                }

                // Check if there's a verification code for this email
                const storedData = verificationCodes.get(email);

                if (!storedData) {
                    return res.status(400).json({
                        success: false,
                        method: "verifyResetCode",
                        message: 'Verify reset code failed: No verification code requested or code expired.'
                    });
                }

                // Check if code is expired
                if (Date.now() > storedData.expiresAt) {
                    verificationCodes.delete(email);
                    return res.status(400).json({
                        success: false,
                        method: "verifyResetCode",
                        message: 'Verify reset code failed: Verification code expired.'
                    });
                }

                // Check if code matches
                if (storedData.code !== code) {
                    return res.status(400).json({
                        success: false,
                        method: "verifyResetCode",
                        message: 'Verify reset code failed: Invalid verification code.'
                    });
                }

                // Code is valid - generate a token for password reset
                const resetToken = crypto.randomBytes(32).toString('hex');

                // Store the token in the user document with expiration
                await UserForgetPassword.update(
                    {
                        password_reset_token: resetToken,
                        password_reset_expires: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
                    },
                    {
                        where: {
                            password_reset_user_id: user.user_id
                        }
                    }
                );

                // Remove the verification code as it's been used
                verificationCodes.delete(email);

                return res.status(200).json({
                    success: true,
                    method: "verifyResetCode",
                    message: 'Code verified successfully',
                    data: {
                        resetToken
                    }
                });

            } catch (error) {
                console.error('Error in code verification:', error);
                return res.status(500).json({
                    success: false,
                    method: "verifyResetCode",
                    message: 'Verify reset code failed: Server error',
                    details: error.message
                });
            }
        }
    }

    resetPassword = () => {
        return async (req, res, next) => {
            try {
                const { resetToken, newPassword, confirmPassword } = req.body;

                if (!resetToken || !newPassword || !confirmPassword) {
                    return res.status(400).json({
                        success: false,
                        method: "resetPassword",
                        message: "Missing required parameters: Reset token, new password, and confirm password are required."
                    });
                }

                // Check if passwords match
                if (newPassword !== confirmPassword) {
                    return res.status(400).json({
                        success: false,
                        method: "resetPassword",
                        path: "confirmPassword",
                        message: "Passwords do not match."
                    });
                }

                // Check password strength
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
                if (!passwordRegex.test(newPassword)) {
                    return res.status(422).json({
                        success: false,
                        method: "resetPassword",
                        path: "newPassword",
                        message: "Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
                    });
                }

                // Find the password reset record with the token that hasn't expired
                const resetRecord = await UserForgetPassword.findOne({
                    where: {
                        password_reset_token: resetToken,
                        password_reset_expires: {
                            [Op.gt]: new Date() // Op.gt means "greater than" - check if expiry is in the future
                        }
                    }
                });

                if (!resetRecord) {
                    return res.status(400).json({
                        success: false,
                        method: "resetPassword",
                        path: "resetToken",
                        message: "Invalid or expired reset token."
                    });
                }

                // Find the user
                const user = await User.findOne({
                    where: {
                        user_id: resetRecord.password_reset_user_id
                    }
                });

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        method: "resetPassword",
                        path: "resetToken",
                        message: "User not found."
                    });
                }

                // Update password
                user.updatePassword = true; // Flag to trigger password hashing in your model hooks
                user.user_password = newPassword;
                await user.save();

                // update user forget password table
                await UserForgetPassword.update(
                    {
                        password_reset_is_used: true,
                    },
                    {
                        where: {
                            password_reset_id: resetRecord.password_reset_id
                        }
                    }
                )

                // Clear the reset record
                await UserForgetPassword.destroy({
                    where: {
                        password_reset_id: resetRecord.password_reset_id,
                        password_reset_user_id: resetRecord.password_reset_user_id,
                    }
                });

                // Create Notification
                await Notification.create({
                    user_id: user.user_id,
                    title: 'Security Alert: Password Changed',
                    message: 'Your account password was successfully reset. If this was not you, contact support immediately.',
                    type: 'warning',
                    link: '/settings/security'
                });

                // Send security email
                const securityMailOptions = {
                    from: `"Fiaxit Security" <${process.env.EMAIL_USERNAME}>`,
                    to: user.user_email,
                    subject: 'Security Alert: Your Password Was Reset',
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
                            <div style="text-align: center; padding: 20px 0;">
                                <h1 style="color: #0d6efd; margin: 0; font-size: 28px; letter-spacing: -1px;">Fiaxit</h1>
                            </div>
                            <div style="background-color: #ffffff; border-radius: 12px; padding: 35px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                <h2 style="margin-top: 0; color: #1a202c; font-size: 22px; text-align: center;">Security Update</h2>
                                <p style="font-size: 16px; color: #4a5568;">Hello ${user.user_fname},</p>
                                <p style="font-size: 16px; color: #4a5568;">This is a confirmation that your Fiaxit account password has been successfully reset. </p>
                                
                                <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0; border: 1px solid #edf2f7; text-align: center;">
                                    <p style="margin: 0; font-weight: 600; color: #2d3748;">Activity: Password Reset</p>
                                    <p style="margin: 5px 0 0; font-size: 14px; color: #718096;">Date: ${new Date().toLocaleString()}</p>
                                </div>
                                
                                <p style="font-size: 14px; color: #e53e3e; background-color: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #f56565;">
                                    <strong>Not you?</strong> If you did not perform this action, your account may have been compromised. Please contact our support team immediately.
                                </p>
                                
                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                                <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">Stay secure, <br> The Fiaxit Security Team</p>
                            </div>
                        </div>
                    `
                };
                await emailHelper.sendMail(securityMailOptions).catch(err => console.error('Security alert email error:', err));

                return res.status(200).json({
                    success: true,
                    method: "resetPassword",
                    message: "Password has been reset successfully."
                });

            } catch (error) {
                console.error('Error in password reset:', error);
                return res.status(500).json({
                    success: false,
                    method: "resetPassword",
                    message: "An error occurred while resetting the password.",
                    details: error.message
                });
            }
        };
    }

    // find user by id
    getUserById = () => {
        return async (req, res, next) => {
            try {
                const userId = req.params.id;
                const user = await User.findOne({
                    where: {
                        user_id: userId
                    }
                });

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        method: "findUserById",
                        message: "User not found."
                    });
                }

                return res.status(200).json({
                    success: true,
                    method: "findUserById",
                    data: await this.formatUserResponse(user, req)
                });

            } catch (error) {
                console.error('Error in findUserById:', error);
                return res.status(500).json({
                    success: false,
                    method: "findUserById",
                    message: "An error occurred while retrieving the user.",
                    details: error.message
                });
            }
        };
    }

    // 
    generateVerificationCode = () => {
        return Math.floor(Math.random() * (999999 - 100001)) + 100001;
    }

    changePassword = () => {
        return async (req, res, next) => {
            try {
                const { current_password, new_password } = req.body;
                const userId = req.userData.user_id;

                const user = await User.findOne({ where: { user_id: userId } });
                if (!user) {
                    return res.status(404).json({ success: false, message: "User not found." });
                }

                const isMatch = await bcrypt.compare(current_password, user.user_password);
                if (!isMatch) {
                    return res.status(401).json({ success: false, message: "Invalid current password." });
                }

                // Password complexity check
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
                if (!passwordRegex.test(new_password)) {
                    return res.status(422).json({
                        success: false,
                        message: "Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
                    });
                }

                user.user_password = new_password;
                user.updatePassword = true;
                await user.save();

                // Create Notification
                await Notification.create({
                    user_id: user.user_id,
                    title: 'Security Alert: Password Updated',
                    message: 'Your account password was successfully changed from your profile settings.',
                    type: 'info',
                    link: '/settings/security'
                });

                // Send confirmation email
                const changeMailOptions = {
                    from: `"Fiaxit Security" <${process.env.EMAIL_USERNAME}>`,
                    to: user.user_email,
                    subject: 'Security Alert: Account Password Changed',
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
                            <div style="text-align: center; padding: 20px 0;">
                                <h1 style="color: #0d6efd; margin: 0; font-size: 28px; letter-spacing: -1px;">Fiaxit</h1>
                            </div>
                            <div style="background-color: #ffffff; border-radius: 12px; padding: 35px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                <h2 style="margin-top: 0; color: #1a202c; font-size: 22px;">Password Changed</h2>
                                <p style="font-size: 16px; color: #4a5568;">Hello ${user.user_fname}, your Fiaxit account password has been successfully updated.</p>
                                
                                <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; margin: 25px 0; border: 1px solid #edf2f7;">
                                    <p style="margin: 0; font-size: 14px; color: #718096;">If you authorized this change, no further action is required.</p>
                                </div>
                                
                                <p style="font-size: 14px; color: #e53e3e; background-color: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #f56565;">
                                    <strong>Security Notice:</strong> If you did not make this change, please recover your account or contact support immediately.
                                </p>
                                
                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                            </div>
                        </div>
                    `
                };
                await emailHelper.sendMail(changeMailOptions).catch(err => console.error('Change password alert email error:', err));

                return res.status(200).json({
                    success: true,
                    message: "Password changed successfully."
                });
            } catch (error) {
                console.error("Change Password Error:", error);
                return res.status(500).json({ success: false, message: "Internal server error." });
            }
        };
    };

    changePIN = () => {
        return async (req, res, next) => {
            try {
                const { current_pin, new_pin } = req.body;
                const userId = req.userData.user_id;

                const user = await User.findOne({ where: { user_id: userId } });
                if (!user) {
                    return res.status(404).json({ success: false, message: "User not found." });
                }

                // PIN is hashed in DB, so use bcrypt.compare
                const isMatch = await bcrypt.compare(current_pin.toString(), user.user_pin);
                if (!isMatch) {
                    return res.status(401).json({ success: false, message: "Invalid current PIN." });
                }

                if (isNaN(new_pin) || new_pin.toString().length !== 4) {
                    return res.status(422).json({ success: false, message: "New PIN must be a 4-digit number." });
                }

                user.user_pin = new_pin;
                user.updatePin = true;
                await user.save();

                // Create Notification
                await Notification.create({
                    user_id: user.user_id,
                    title: 'Security Alert: Transaction PIN Updated',
                    message: 'Your transaction PIN was successfully changed.',
                    type: 'info',
                    link: '/settings/security'
                });

                return res.status(200).json({
                    success: true,
                    message: "PIN changed successfully."
                });
            } catch (error) {
                console.error("Change PIN Error:", error);
                return res.status(500).json({ success: false, message: "Internal server error." });
            }
        };
    };

    /**
     * Helper to format user object for public consumption
     * @param {Object} user - User record (Sequelize model or plain object)
     * @param {Object} req - Express request object
     * @returns {Object} - Formatted user object
     */
    formatUserResponse = async (user, req) => {
        const data = user.toJSON ? user.toJSON() : { ...user };

        // Exclude sensitive fields
        delete data.user_password;
        delete data.user_pin;
        delete data.user_vericode;

        // Format image URL
        if (data.user_image && !data.user_image.startsWith('http')) {
            data.user_image = `${req.protocol}://${req.get('host')}/${data.user_image}`;
        }

        return data;
    }

}

module.exports = new UsersController() // instantiate class and add to module so that we can use it anywhere else