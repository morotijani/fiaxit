const express = require('express');
const router = express.Router();
const UserController = require('../controllers/users-controller');
const userAuth = require("../middleware/check-auth");

// Usage (example): POST /api/v1/signup
/** body
 * {
        "fname": "",
        "mname": "", // not compulsory
        "lname": "",
        "email": "",
        "phone": "",
        "password": "",
        "confirm_password": "", 
        "pin": "",
        "invitationcode": "" // not compulsory
    }
*/
router.post('/signup', UserController.signup()); // Register users

// Usage (example): POST /api/v1/login
/** body
 * {
        "email": "",
        "password": "",
    }
*/
router.post('/login', UserController.login()); // login user

// Usage (example): PATCH /api/v1/update/:id
/** body
 * {
        "fname": "",
        "mname": "",
        "lname": "",
        "email": "",
        "phone": "",
        "password": "",
        "confirm_password": "", 
        "pin": "",
        "invitationcode": ""
    }
*/
router.patch('/update/:id', userAuth.authenticate, UserController.update()); // update user

// Usage (example): GET /api/v1/loggedInUser
router.get('/loggedInUser', userAuth.authenticate, UserController.loggedInUser()); // logged in user

// Usage (example): GET /api/v1/logout
router.get('/logout', userAuth.authenticate, UserController.logout()); // Logout route - authenticate middleware adds token to req.token

module.exports = router;