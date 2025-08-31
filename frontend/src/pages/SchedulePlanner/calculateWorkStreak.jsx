const calculateWorkStreak = (personnelId, scheduleDate, allSchedules) => {
    const dateToCheck = new Date(scheduleDate);

    // Filter schedules for this personnel within the last 6 days
    const schedules = allSchedules
        .filter(schedule =>
            schedule.personnelId === personnelId &&
            new Date(schedule.day) <= dateToCheck
        )
        .map(schedule => ({
            day: new Date(schedule.day),
            service: schedule.service,
        }));

    // Sort schedules by date
    schedules.sort((a, b) => a.day - b.day);

    let currStreak = 1; // Start with 1 since there's an entry for this date

    // Iterate from most recent past day to 6 days before
    for (let i = schedules.length - 1; i > 0; i--) {
        const prevDate = schedules[i - 1].day;
        const currDate = schedules[i].day;

        const dayDifference = (currDate - prevDate) / (1000 * 60 * 60 * 24);

        if (dayDifference === 1) {
            currStreak += 1;
        } else {
            break;
        }
    }

    return currStreak
};

export default calculateWorkStreak