// managementCRM_Web/backend/routes/applicationNotifications.js

const express = require('express');
const router = express.Router();
const { getNotifications, acknowledgeNotification } = require('../controllers/applicationNotificationsController');

// Route to get all notifications for a specific user (and broadcasts)
router.get('/:user_ID', getNotifications);

// Route to mark a notification as read
router.patch('/:id/acknowledge', acknowledgeNotification);

module.exports = router;