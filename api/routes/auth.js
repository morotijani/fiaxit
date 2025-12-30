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
router.post('/signup', AuthController.signup()); // Register user

router.get('/verify/:id/:code', AuthController.verify()); // verify user

// resend verification code
router.post('/resend-vericode', AuthController.resendVericode()); // resend verification code

// Usage (example): POST /api/v1/login
/** body
 * {
        "email": "",
        "password": "",
    }
*/
router.post('/login', AuthController.login()); // login user
router.post('/login/2fa', AuthController.verifyLogin2FA()); // verify 2fa during login

// Usage (example): GET /api/v1/loggedInUser
router.get('/loggedInUser', userAuth.authenticate, AuthController.loggedInUser()); // logged in user

// Usage (example): GET /api/v1/logout
router.get('/logout', userAuth.authenticate, AuthController.logout()); // Logout route - authenticate middleware adds token to req.token

// Usage (example): POST /api/v1/forgot-password
/** body
 * {
        "email": "", 
    }
*/
router.post('/forgot-password', AuthController.forgetPassword()) // Forget password 

// Usage (example): POST /api/v1/verify-reset-code
/** body
  * {
        "email": "", 
        "code": ""
    }
*/
router.post('/verify-reset-code', AuthController.verifyResetCode()) // Endpoint to verify the code and allow password reset (6 Digit Verification Code) 

// Usage (example): POST /api/v1/reset-password
/** body
 * {
        "password": "",
        "confirm_password": "", 
    }
*/
router.post('/reset-password', AuthController.resetPassword()) // reset password

// GET USER BY ID
// Usage (example): GET /api/v1/user/:id
router.get('/user/:id', AuthController.getUserById());

module.exports = router;