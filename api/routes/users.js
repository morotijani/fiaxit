const express = require('express');
const router = express.Router();
const UserController = require('../controllers/users-controller');
const UserKYCController = require('../controllers/user-kyc-controller');
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
const storage = require('../helpers/storage');

router.patch('/update/:id', userAuth.authenticate, UserController.update()); // update user

// Profile Image Upload
router.post('/profile-image', userAuth.authenticate, storage.single('profile_image'), UserController.uploadProfileImage());

// KYC Routes
/**
    * Submit KYC documents (Multipart form-data)
    * fields: kyc_id_type, kyc_id_number, address (JSON string)
    * files: document_front, document_back, selfie
*/
router.post('/kyc/submit', userAuth.authenticate, storage.fields([
    { name: 'document_front', maxCount: 1 },
    { name: 'document_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
]), UserKYCController.submitKYC());

// Get KYC status
router.get('/kyc/status', userAuth.authenticate, UserKYCController.getKYCStatus());

// Admin route to manage KYC (requires admin privileges)
router.get('/kyc/pending', userAuth.authenticate, userAuth.isAdmin, UserKYCController.listPendingKYC());
router.patch('/kyc/verify/:userId', userAuth.authenticate, userAuth.isAdmin, UserKYCController.verifyKYC());

// Security updates
router.patch('/change-password', userAuth.authenticate, UserController.changePassword());
router.patch('/change-pin', userAuth.authenticate, UserController.changePIN());

module.exports = router;