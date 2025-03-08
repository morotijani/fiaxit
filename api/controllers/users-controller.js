const User = require('../models/user-model');
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')

class UsersController {
    signup = () => {
        return async (req, res, next) => {
            const userId = uuidv4();

            // check if email is a valid email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(req.body.email)) {
                return res.status(422).json({
                    success: false, 
                    method: "registerUser",
                    path: "email",
                    message: "Please enter a valid email address."
                });
            }

            // check for password length and characters
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{6,}$/;
            if (!passwordRegex.test(req.body.password)) {
                return res.status(422).json({
                    success: false, 
                    method: "registerUser",
                    path: "password",
                    message: "Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
                });
            }

            // check if password and confirm password is equal
            if (req.body.password !== req.body.confirm_password) {
                return res.status(422).json([
                    {
                        path: "password",
                        message: "Passwords do not match."
                    },
                    {
                        path: "confirm_password",
                        message: "Passwords do not match."
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

            try {
                const user = await User.create({
                    user_id: userId,
                    user_fname: req.body.fname,
                    user_mname: req.body.mname || null, // if middle name is not provided, set to null
                    user_lname: req.body.lname,
                    user_email: req.body.email,
                    user_phone: req.body.phone || null, // if phone is not provided, set to null
                    user_password: req.body.password, 
                    user_pin: req.body.pin, 
                    user_invitationcode: req.body.invitationcode || null // if invitation code is not provided, set to null
                })
                res.status(200).json({
                    success: true,
                    method: "registerUser", 
                    user: user
                })
            } catch(err) {
                res.status(422).json(err.errors)
            }
        }
    }

    login = () => {
        return async (req, res, next) => {
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
            const resp = {success: false, method: "login", errors: errors}
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
                        expiresIn: "30d"
                    });
                    resp.success = true;
                    resp.method = "login";
                    resp.errors = [];
                    resp.token = token
                }
            }
            res.status(200).json(resp)
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
                        msg: "You do not have permission to update this user."
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
                    resp.user = user
                }
                res.status(200).json(resp)
            } catch (err) {
                return res.status(401).json({
                    success: false, 
                    method: 'updateUser', 
                    msg: "An error occured on updating user", 
                    details: err.message
                })
            }
        }
    }

    loggedInUser = () => {
        return async (req, res, next) => {
            const resp = {
                success: false, 
                method: "loggedInUser", 
                user: null, 
                msg: "User not found."
            }
            const token = req.headers.authorization ? req.headers.authorization.split(' ')[1] : "";
            const decoded = await jwt.verify(token, process.env.JWT_KEY);
            const user = await User.findOne({ // get user
                where: {
                    user_id : decoded.user_id
                }
            })
            const data = user.toJSON()
            delete data.user_password; //
            resp.success = true;
            resp.method =  "loggedInUser";
            resp.user = data;
            resp.msg = "User is logged in.";

            res.status(200).json(resp);
        }
    }

}

module.exports = new UsersController() // instantiate class and add to module so that we can use it anywhere else