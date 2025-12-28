const Notification = require('../models/notification-model');

class NotificationController {

    // Get all notifications for the user
    getAll = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const { rows, count } = await Notification.findAndCountAll({
                    where: { user_id: userId },
                    order: [['createdAt', 'DESC']],
                    limit: 50
                });

                res.status(200).json({
                    success: true,
                    data: rows,
                    total: count
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to fetch notifications",
                    error: err.message
                });
            }
        };
    };

    // Mark notification as read
    markAsRead = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const notificationId = req.params.id;

                const notification = await Notification.findOne({
                    where: { id: notificationId, user_id: userId }
                });

                if (!notification) {
                    return res.status(404).json({
                        success: false,
                        message: "Notification not found"
                    });
                }

                await notification.update({ is_read: true });

                res.status(200).json({
                    success: true,
                    message: "Notification marked as read"
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update notification",
                    error: err.message
                });
            }
        };
    };

    // Mark all as read
    markAllAsRead = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                await Notification.update(
                    { is_read: true },
                    { where: { user_id: userId, is_read: false } }
                );

                res.status(200).json({
                    success: true,
                    message: "All notifications marked as read"
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update notifications",
                    error: err.message
                });
            }
        };
    };

    // Delete a notification
    delete = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const notificationId = req.params.id;

                const notification = await Notification.findOne({
                    where: { id: notificationId, user_id: userId }
                });

                if (!notification) {
                    return res.status(404).json({
                        success: false,
                        message: "Notification not found"
                    });
                }

                await notification.destroy();

                res.status(200).json({
                    success: true,
                    message: "Notification deleted"
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    message: "Failed to delete notification",
                    error: err.message
                });
            }
        };
    };

    // Internal helper to create notifications (not exposed via route)
    async createNotification(userId, title, message, type = 'info', sourceId = null, sourceType = null, link = null) {
        try {
            return await Notification.create({
                user_id: userId,
                title,
                message,
                type,
                source_id: sourceId,
                source_type: sourceType,
                link
            });
        } catch (err) {
            console.error('Failed to create notification internally:', err);
            return null;
        }
    }
}

module.exports = new NotificationController();
