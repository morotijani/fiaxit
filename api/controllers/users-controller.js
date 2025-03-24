const User = require('../models/user-model');
const UserForgetPassword = require('../models/user-forget-password-model')
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const { blacklistToken } = require('../middleware/check-auth');
const nodemailer = require('nodemailer')
const crypto = require('crypto')
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

// Store verification codes temporarily (in production, use Redis or similar)
const verificationCodes = new Map();

class UsersController {
    
    signup = () => {
        return async (req, res, next) => {
            try {
                const userId = uuidv4();
                const vericode = uuidv4(); // Generate a random code for email verification code

                // check if email is a valid email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(req.body.email)) {
                    return res.status(422).json({
                        success: false, 
                        method: "registerUser", 
                        path: "email", 
                        message: "Registration failed: Please enter a valid email address."
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
                    message: "Registration failed: Email already exist."
                })
                }

                // check for password length and characters
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
                if (!passwordRegex.test(req.body.password)) {
                    return res.status(422).json({
                        success: false, 
                        method: "registerUser", 
                        path: "password", 
                        message: "Registration failed: Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
                    });
                }

                // check if password and confirm password is equal
                if (req.body.password !== req.body.confirm_password) {
                    return res.status(422).json([
                        {
                            path: "password", 
                            message: "Registration failed: Passwords do not match."
                        },
                        {
                            path: "confirm_password", 
                            message: "Registration failed: Passwords do not match."
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
                        message: "Registration failed: An error occured while registering user.", 
                        details: error.message
                    })
                }

                // send mail to user email to verify their account
                const mailOptions = {
                    from: "Fiaxit 👻" + process.env.EMAIL_USERNAME,  
                    to: user_email, 
                    subject: 'Verify your account', 
                    html: `
                        <h3>${req.body.fname}</h3>
                        <p>Thank you for registering with Fiaxit 👻. Please click on the following link to verify your account: https://sites.local:6000/api/user/verify/${userId}/${vericode}
                        <br>
                        With love,
                        <br>
                        - Fiaxit 👻
                    `
                };

                // Send the email
                await transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log('Error sending email:', error);
                    } else {
                        console.log('Email sent:', info.response);
                    }
                });

                // await transporter.sendMail(mailOptions);

                res.status(200).json({
                    success: true, 
                    method: "registerUser", 
                    data: {
                        user: user
                    }
                })
            } catch(error) {
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

                // check if user id exist 
                const user = await User.findOne({
                    where: {
                        id: uid
                    }
                })

                if (!user) {
                    return res.status(400).json({
                        success: false, 
                        method: "verifyUser", 
                        message: "User not found"
                    })
                }

                // check if code provided exist and if it tallys with user data
                if (user.user_vericode !== code) {
                    return res.status(400).json({
                        success: false, 
                        method: "verifyUser", 
                        message: "Invalid verification code"
                    })
                }

                // update user data
                user.user_verified = true
                user.user_vericode = null
                user.save()

                res.status(200).json({
                    success: true, 
                    method: "verifyUser", 
                    data: user
                })
            } catch (error) {
                return res.status(500).json({
                    success: false, 
                    method: "verifyUser", 
                    message: "An error occured while verifying user.", 
                    details: error.message
                })
            }
        }
    }

    // login user
    login = () => {
        return async (req, res, next) => {
            try {
                const msg =
            }
        }
    }

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
                        const signVals = user.toJSON(); //
                        delete signVals.password // remove password from the signvals
                        const token = await jwt.sign(signVals, process.env.JWT_KEY, {
                            expiresIn: "7d"
                        });
                        resp.success = true;
                        resp.method = "login";
                        resp.errors = [];
                        resp.token = token
                    }
                } else {
                    return res.status(401).json({
                        success: false,
                        method: "userLogin",
                        message: "User not found."
                    })
                }
                res.status(200).json(resp)
            } catch(error) {
                return res.status(500).json({
                    success: false, 
                    method: "userLogin", 
                    message: "An error occurred while logging in the user.", 
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
                        message: "Logout failed: No authentication token provided."
                    });
                }

                const blacklisted = await blacklistToken(token);
                if (blacklisted) {
                    res.status(200).json({
                        success: true, 
                        method: "userLogout", 
                        message: "Logout successful: Token blacklisted. User has been logged out."       
                    });
                } else {
                    res.status(400).json({
                        success: false, 
                        method: "userLogout",
                        message: "Logout failed (Could not blacklist token): An error occurred while logging out the user.",
                        error: error.message
                    });
                }
            } catch(error) {
                res.status(500).json({
                    success: false, 
                    method: "userLogout",
                    message: "Logout failed: An error occurred while logging out the user.",
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
                    if (req.body.password) {
                        user.updatePassword = true
                        user.user_password = req.body.password
                    }
                    if (req.body.pin) {
                        user.updatePin = true;
                        user.user_pin = req.body.pin
                    }
                    user.user_invitationcode = req.body.invitationcode || user.user_invitationcode
                    await user.save();
                    await user.reload();
                    resp.success = true;
                    resp.method = "updateUser";
                    resp.data = { user: user }
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
                    data: {user: null}, 
                    message: "User not found."
                }
            
                const user = req.userData
                const data = user
                delete data.user_password; // remove password from user data for security reasons

                resp.success = true;
                resp.method =  "loggedInUser";
                resp.data = {user: data};
                resp.message = "User is logged in.";

                res.status(200).json(resp);
            } catch(error) {
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
                        status: false, 
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
                        status: false,
                        method: "userForgetPassword", 
                        message: "Forget Password failed: User not found.",
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
                    from: "Fiaxit 👻" + process.env.EMAIL_USERNAME, 
                    to: email, 
                    subject: 'Password Reset Verification Code.', 
                    html:  `
                        <h1>Password Reset Request</h1>
                        <p>You requested a password reset. Please use the following verification code to reset your password:</p>
                        <h2 style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 24px;">${verificationCode}</h2>
                        <p>This code will expire in 15 minutes.</p>
                        <p>If you didn't request a password reset, please ignore this email.</p>
                    `
                }

                // Send the email
                await transporter.sendMail(mailOptions);

                // inset into forget password table
                const insert = await UserForgetPassword.create({
                    password_reset_id: '', 
                    password_reset_user_id: user.user_id, 
                    password_reset_token: verificationCode, 
                    password_reset_expire: Date.now() + 15 * 60 * 1000 // 15 minutes from now
                });

                return res.status(201).json({
                    success: true, 
                    method: "userForgtPassword", 
                    message: "Forget password verification code sent to your email.", 
                    data: {
                        insert
                    }
                })
            } catch(error) {
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
                        status: false, 
                        method: "verifyResetCode", 
                        message: 'Verify reset code failed: No verification code requested or code expired.' 
                    });
                }
                
                // Check if code is expired
                if (Date.now() > storedData.expiresAt) {
                    verificationCodes.delete(email);
                    return res.status(400).json({ 
                        status: false, 
                        method: "verifyResetCode", 
                        message: 'Verify reset code failed: Verification code expired.' 
                    });
                }
                
                // Check if code matches
                if (storedData.code !== code) {
                    return res.status(400).json({ 
                        status: false, 
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
                    status: false, 
                    method: "verifyResetCode", 
                    message: 'Code verified successfully',
                    data: {
                        resetToken
                    }
                });
                
            } catch (error) {
                console.error('Error in code verification:', error);
                return res.status(500).json({ 
                    status: false, 
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
                        message: "Passwords do not match."
                    });
                }
                
                // Check password strength
                const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
                if (!passwordRegex.test(newPassword)) {
                    return res.status(422).json({
                        success: false, 
                        method: "resetPassword", 
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
    
    generateVerificationCode = () => {
        return Math.floor(Math.random() * (999999 - 100001)) + 100001;
    }

}

module.exports = new UsersController() // instantiate class and add to module so that we can use it anywhere else