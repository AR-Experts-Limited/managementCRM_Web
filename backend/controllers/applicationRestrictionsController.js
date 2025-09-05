const moment = require('moment-timezone');

const getModels = (req) => ({
    Notification: req.db.model('Notification', require('../models/Notification').schema),
    Deduction: req.db.model('Deduction', require('../models/Deduction').schema),
    AdditionalCharges: req.db.model('AdditionalCharges', require('../models/AdditionalCharges').schema),
    AppData: req.db.model('AppData', require('../models/appdata').schema),
});

const checkRestrictions = async (req, res) => {
    const { Notification, Deduction, AdditionalCharges, AppData } = getModels(req);
    const { user_ID } = req.params;

    if (!user_ID) {
        return res.status(400).json({ message: 'user_ID is required.' });
    }

    try {
        // Check if a trip has been started today
        const today = moment().tz('Europe/London');
        const startOfDay = today.clone().startOf('day').toDate();
        const endOfDay = today.clone().endOf('day').toDate();

        const tripsStartedTodayCount = await AppData.countDocuments({
            user_ID,
            'start_trip_checklist.time_and_date': {
                $gte: startOfDay,
                $lte: endOfDay
            }
        });
        const hasStartedTripToday = tripsStartedTodayCount > 0;

        // Existing checks
        const unacknowledgedNotifications = await Notification.countDocuments({
            "notification.user_ID": user_ID,
            "notification.isRead": false,
            "deleted": { $ne: true }
        });

        const unsignedDeductions = await Deduction.countDocuments({
            user_ID,
            signed: false
        });

        const unsignedAdditionalDeductions = await AdditionalCharges.countDocuments({
            user_ID,
            signed: false,
            type: 'deduction'
        });

        res.status(200).json({
            unacknowledgedNotifications,
            unsignedDeductions,
            unsignedAdditionalDeductions,
            hasStartedTripToday, // Add new flag to response
        });

    } catch (error) {
        console.error('Error checking restrictions:', error);
        res.status(500).json({ message: 'Error checking restrictions', error: error.message });
    }
};

module.exports = { checkRestrictions };

