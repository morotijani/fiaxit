const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notification-controller');

// GET /v1/notifications
router.get('/', NotificationController.getAll());

// PATCH /v1/notifications/:id/read
router.patch('/:id/read', NotificationController.markAsRead());

// PATCH /v1/notifications/read-all
router.patch('/read-all', NotificationController.markAllAsRead());

// DELETE /v1/notifications/:id
router.delete('/:id', NotificationController.delete());

module.exports = router;
