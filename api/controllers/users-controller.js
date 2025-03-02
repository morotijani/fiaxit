const User = require('../models/user-model');

class UsersController {
    signup = () => {
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                method: "signup"
            })
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
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                method: "update"
            })
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