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
router.patch('/update/:id', userAuth, UserController.update()); // update user

// Usage (example): GET /api/v1/loggedInUser
router.get('/loggedInUser', UserController.loggedInUser()); // logged in user

module.exports = router;