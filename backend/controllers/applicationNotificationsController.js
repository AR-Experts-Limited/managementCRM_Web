// managementCRM_Web/backend/controllers/applicationNotificationsController.js

const mongoose = require('mongoose');

// GET all notifications for a specific user, including broadcast messages
const getNotifications = async (req, res) => {
    const Notification = req.db.model('Notification', require('../models/Notification').schema);
    try {
        const { user_ID } = req.params;

        // --- THE FIX IS HERE ---
        // The query now correctly looks for the user_ID inside the nested notification object.
        const notifications = await Notification.find({
            $or: [
                { "notification.user_ID": user_ID },
                { "notification.user_ID": { $exists: false }, targetDevice: 'app' }
            ],
            "deleted": { $ne: true }
        }).sort({ "notification.createdAt": -1 });
        // --- END OF FIX ---

        res.status(200).json(notifications);
    } catch (error) {
        console.error('Error fetching notifications for app:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// PATCH to acknowledge (mark as read) a specific notification
const acknowledgeNotification = async (req, res) => {
    const Notification = req.db.model('Notification', require('../models/Notification').schema);
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid notification ID.' });
        }

        const notification = await Notification.findByIdAndUpdate(
            id,
            { $set: { "notification.isRead": true } },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        res.status(200).json({ message: 'Notification acknowledged successfully.', notification });
    } catch (error) {
        console.error('Error acknowledging notification:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getNotifications,
    acknowledgeNotification,
};