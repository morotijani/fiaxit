const User = require('../models/user-model');
const { v4: uuidv4 } = require('uuid')

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
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                method: "login"
            })
        }
    }

    update = () => {
        return async (req, res, next) => {
            const resp = {
                success: false, 
                user: null
            };
            const userId = req.params.id;
            const user = await User.findOne({
                where: {
                    user_id: userId
                }  
            })
            // const user = await User.findByPk(user_id) // find by using primary key
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
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                method: "loggedInUser"
            })
        }
    }

}

module.exports = new UsersController() // instantiate class and add to module so that we can use it anywhere else