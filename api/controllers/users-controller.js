const User = require('../models/user-model');
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')

class UsersController {
    signup = () => {
        return async (req, res, next) => {
            const userId = uuidv4();
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

            try {
                const user = await User.create({
                    user_id: userId,
                    fname: req.body.fname,
                    lname: req.body.lname,
                    email: req.body.email,
                    password: req.body.password
                })
                res.status(200).json({
                    success: true,
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
            const resp = {success: false, errors: errors}
            const user = await User.findOne({
                where: {
                    email: req.body.email
                }
            })
            const password = req.body.password
            if (user) {
                const passed = await bcrypt.compare(password, user.password)
                if (passed) {
                    const signVals = user.toJSON(); //
                    delete signVals.password // remove password from the signvals
                    const token = await jwt.sign(signVals, process.env.JWT_KEY, {
                        expiresIn: "30d"
                    });
                    resp.success = true;
                    resp.errors = [];
                    resp.token = token
                }
            }
            res.status(200).json(resp)
        }
    }

    update = () => {
        return async (req, res, next) => {
            const resp = {
                success: false, 
                user: null
            };
            const userId = req.params.id;
            // check to see if user is updating not him/herself
            if (userId != req.userData.user_id) {
                return res.status(401).json({msg: "You do not have permission to update this user."})
            }
            const user = await User.findOne({
                where: {
                    user_id: userId
                }
            })
            // const user = await User.findByPk(userId) // find by using primary key
            if (user) {
                user.fname = req.body.fname
                user.lname = req.body.lname
                user.email = req.body.email
                if (req.body.password) {
                    user.updatePassword = true
                    user.password = req.body.password
                }
                await user.save();
                await user.reload();
                resp.success = true;
                resp.user = user
            }
            res.status(200).json(resp)
        }
    }

    loggedInUser = () => {
        return async (req, res, next) => {
            const resp = {
                success: false, 
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
            delete data.password; //
            resp.success = true;
            resp.user = data;
            resp.msg = "User is logged in.";

            res.status(200).json(resp);
        }
    }

}

module.exports = new UsersController() // instantiate class and add to module so that we can use it anywhere else