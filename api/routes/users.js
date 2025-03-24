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

// KYC Routes
/**
    * Submit KYC documents
    * body {
    *   idType: "passport|national_id|drivers_license",
    *   idNumber: "",
    *   documentFront: "base64_encoded_image",
    *   documentBack: "base64_encoded_image",
    *   selfie: "base64_encoded_image",
    *   address: {
    *     street: "",
    *     city: "",
    *     state: "",
    *     postalCode: "",
    *     country: ""
    *   }
    * }
*/
router.post('/kyc/submit', userAuth.authenticate, UserController.submitKYC());

// Get KYC status
router.get('/kyc/status', userAuth.authenticate, UserController.getKYCStatus());

// Admin route to verify KYC (requires admin privileges)
router.patch('/kyc/verify/:userId', userAuth.authenticate, userAuth.isAdmin, UserController.verifyKYC());

module.exports = router;