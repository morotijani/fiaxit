const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin-controller');
const { authenticate, isAdmin } = require('../middleware/check-auth');

// All admin routes are protected by authenticate and isAdmin
router.use(authenticate, isAdmin);

// Core Admin Dashboard
router.get('/stats', adminController.getStats());

// User Management
router.get('/users', adminController.listUsers());
router.patch('/users/:userId', adminController.updateUser());

// Transaction Monitor
router.get('/transactions', adminController.listTransactions());

module.exports = router;
