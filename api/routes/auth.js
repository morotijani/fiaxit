const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/users-controller');
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
router.post('/signup', AuthController.signup()); // Register users

// Usage (example): POST /api/v1/login
/** body
 * {
        "email": "",
        "password": "",
    }
*/
router.post('/login', AuthController.login()); // login user

// Usage (example): GET /api/v1/loggedInUser
router.get('/loggedInUser', userAuth.authenticate, AuthController.loggedInUser()); // logged in user

// Usage (example): GET /api/v1/logout
router.get('/logout', userAuth.authenticate, AuthController.logout()); // Logout route - authenticate middleware adds token to req.token

// Usage (example): POST /api/v1/forgot-password
/** body
 * {
        "email": "", 
        "pin": "",
    }
*/
router.post('/forgot-password', AuthController.forgetPassword()) // Forget password 

// Usage (example): POST /api/v1/reset-verify
/** body
  * {
        "code": "", 
    }
*/
router.post('/reset-verify', AuthController.verifyVerificationCode()) // reset verify (6 Digit Verification Code) 

// Usage (example): POST /api/v1/reset-password
/** body
 * {
        "pin": "",
        "password": "",
        "confirm_password": "", 
    }
*/
router.post('/reset-password', AuthController.resetPassword()) // reset password

module.exports = router;