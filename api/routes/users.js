const express = require('express');
const router = express.Router();
const UserController = require('../controllers/users-controller');
const userAuth = require("../middleware/check-auth");

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

module.exports = router;