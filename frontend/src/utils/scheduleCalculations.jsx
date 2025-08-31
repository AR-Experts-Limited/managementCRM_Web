import { memoize } from 'lodash';

export const calculateAllWorkStreaks = memoize(
    (personnels, schedules) => {
        const streaks = {};
        // Group schedules by personnel first
        const schedulesByPersonnel = {};
        schedules.forEach(schedule => {
            if (!schedulesByPersonnel[schedule.personnelId]) {
                schedulesByPersonnel[schedule.personnelId] = [];
            }
            if (schedule.service !== 'Voluntary-Day-off')
                schedulesByPersonnel[schedule.personnelId].push({
                    day: new Date(schedule.day),
                    service: schedule.service
                });
        });

        // For each personnel, calculate streaks for all their scheduled days
        personnels.forEach(personnel => {
            const personnelSchedules = schedulesByPersonnel[personnel._id] || [];

            // Sort schedules by date
            personnelSchedules.sort((a, b) => a.day - b.day);

            // Calculate streaks for all dates at once
            const personnelStreaks = {};
            let currentStreak = 0;

            for (let i = 0; i < personnelSchedules.length; i++) {
                if (i === 0) {
                    currentStreak = 1;
                } else {
                    const prevDate = personnelSchedules[i - 1].day;
                    const currDate = personnelSchedules[i].day;
                    const dayDifference = (currDate - prevDate) / (1000 * 60 * 60 * 24);

                    currentStreak = dayDifference === 1 ? currentStreak + 1 : 1;
                }

                const dateKey = personnelSchedules[i].day.toLocaleDateString('en-UK');
                personnelStreaks[dateKey] = currentStreak;
            }

            streaks[personnel._id] = personnelStreaks;
        });

        return streaks;
    },
    (personnels, schedules) => {
        // Cache key based on personnel IDs and schedule IDs/timestamps
        const personnelKey = personnels.map(d => d._id).join(',');
        const scheduleKey = schedules.map(s => `${s._id}-${s.day}`).join(',');
        return `${personnelKey}|${scheduleKey}`;
    }
);

/**
 * Memoized function to check continuous schedules
 */
export const checkAllContinuousSchedules = memoize(
    (personnels, schedules, dateRange) => {
        const continuousStatus = {};

        // Group schedules by personnel
        const schedulesByPersonnel = {};
        schedules.forEach(schedule => {
            const personnelId = schedule.personnelId;
            if (!schedulesByPersonnel[personnelId]) {
                schedulesByPersonnel[personnelId] = [];
            }
            if (schedule.service !== 'Voluntary-Day-off')
                schedulesByPersonnel[personnelId].push(new Date(schedule.day));
        });

        // For each personnel
        personnels.forEach(personnel => {
            const personnelId = personnel._id;
            const existingDates = schedulesByPersonnel[personnelId] || [];
            const status = {};

            // Simulate for each date in the dateRange
            dateRange.forEach(simulatedDateStr => {
                const newDate = new Date(simulatedDateStr);
                const newTime = newDate.getTime();

                // Build ±6 day window
                const windowDates = existingDates.filter(date => {
                    const diff = (date - newDate) / (1000 * 60 * 60 * 24);
                    return diff >= -6 && diff <= 6;
                });

                // Add the simulated date
                windowDates.push(newDate);

                // Remove duplicates and sort
                const uniqueSorted = Array.from(new Set(windowDates.map(d => d.getTime())))
                    .map(t => new Date(t))
                    .sort((a, b) => a - b);

                // Check for 7-day streaks
                let consecutiveDays = 1;
                let streak = [];

                for (let i = 1; i < uniqueSorted.length; i++) {
                    const prev = uniqueSorted[i - 1];
                    const curr = uniqueSorted[i];
                    const diff = (curr - prev) / (1000 * 60 * 60 * 24);

                    if (diff === 1) {
                        consecutiveDays++;
                        if (consecutiveDays === 2) {
                            streak.push(prev, curr);
                        } else {
                            streak.push(curr);
                        }
                    } else {
                        consecutiveDays = 1;
                        streak = [];
                    }

                    if (consecutiveDays >= 7) {
                        const index = streak.findIndex(d => d.getTime() === newTime);
                        const key = newDate.toLocaleDateString('en-UK');

                        if (index === 0 || index === 6) {
                            status[key] = "1"; // Start or end of 7-day streak
                        } else if (index > 0 && index < 6) {
                            status[key] = "2"; // Mid of 7-day streak
                        }

                        return; // No need to continue once marked
                    }
                }

                const key = newDate.toLocaleDateString('en-UK');
                if (!status[key]) {
                    status[key] = "3"; // No 7-day streak created
                }
            });

            continuousStatus[personnelId] = status;
        });

        return continuousStatus;
    },
    (personnels, schedules, dateRange) => {
        const personnelKey = personnels.map(d => d._id).join(',');
        const scheduleKey = schedules.map(s => `${s._id}-${s.day}`).join(',');
        const dateRangeKey = dateRange.join(',');
        return `${personnelKey}|${scheduleKey}|${dateRangeKey}`;
    }
);


