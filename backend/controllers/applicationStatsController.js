const mongoose = require('mongoose');
const moment = require('moment-timezone');

const getModels = (req) => ({
    Deduction: req.db.model('Deduction', require('../models/Deduction').schema),
    AdditionalCharges: req.db.model('AdditionalCharges', require('../models/AdditionalCharges').schema),
    AppData: req.db.model('AppData', require('../models/AppData').schema),
});

const getTripStats = async (req, res) => {
    const { Deduction, AdditionalCharges, AppData } = getModels(req);
    const { user_ID } = req.params;

    if (!user_ID) {
        return res.status(400).json({ message: 'user_ID is required.' });
    }

    try {
        const [completedTrips, deductionCount, additionalDeductionCount] = await Promise.all([
            AppData.find({ user_ID, trip_status: 'completed' }).lean(),
            Deduction.countDocuments({ user_ID }),
            AdditionalCharges.countDocuments({ user_ID, type: 'deduction' })
        ]);

        if (completedTrips.length === 0) {
            return res.status(200).json({
                totalTripsCompleted: 0,
                totalMilesDriven: 0,
                averageTripTime: '0h 0m',
                averageStartTime: 'N/A',
                averageEndTime: 'N/A',
                totalDeductions: deductionCount + additionalDeductionCount,
            });
        }

        let totalMilesDriven = 0;
        let totalTripDurationMs = 0;
        let totalStartMinutes = 0;
        let totalEndMinutes = 0;

        completedTrips.forEach(trip => {
            const start = trip.start_trip_checklist;
            const end = trip.end_trip_checklist;

            if (start?.miles && end?.miles) {
                totalMilesDriven += (end.miles - start.miles);
            }

            if (start?.time_and_date && end?.time_and_date) {
                const startTime = moment(start.time_and_date);
                const endTime = moment(end.time_and_date);
                totalTripDurationMs += endTime.diff(startTime);
                
                totalStartMinutes += (startTime.hours() * 60) + startTime.minutes();
                totalEndMinutes += (endTime.hours() * 60) + endTime.minutes();
            }
        });

        const avgDurationMs = totalTripDurationMs / completedTrips.length;
        const avgHours = Math.floor(avgDurationMs / 3600000);
        const avgMinutes = Math.round((avgDurationMs % 3600000) / 60000);

        const formatAvgTime = (totalMinutes) => {
            const avgMins = totalMinutes / completedTrips.length;
            const hours = Math.floor(avgMins / 60).toString().padStart(2, '0');
            const minutes = Math.round(avgMins % 60).toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        };

        res.status(200).json({
            totalTripsCompleted: completedTrips.length,
            totalMilesDriven: Math.round(totalMilesDriven),
            averageTripTime: `${avgHours}h ${avgMinutes}m`,
            averageStartTime: formatAvgTime(totalStartMinutes),
            averageEndTime: formatAvgTime(totalEndMinutes),
            totalDeductions: deductionCount + additionalDeductionCount,
        });

    } catch (error) {
        console.error('Error fetching trip stats:', error);
        res.status(500).json({ message: 'Error fetching trip stats', error: error.message });
    }
};

module.exports = { getTripStats };
