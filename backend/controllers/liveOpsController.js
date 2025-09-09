const AppData = require('../models/AppData');
const { sendToClients } = require('../utils/sseService');

// GET records from AppData
const fetchAppData = async (req, res) => {
  try {
    const { personnelId, startDay, endDay } = req.body || {};

    // Expect an array; also accept a single value
    const ids = Array.isArray(personnelId)
      ? personnelId.filter(Boolean)
      : (personnelId ? [personnelId] : []);

    console.log("Logging in Backend - ", personnelId, startDay, endDay);

    if (!ids.length || !startDay || !endDay) {
      return res.status(400).json({
        message: "personnelId, startDay, and endDay are required",
      });
    }

    const AppData = req.db.model('AppData', require('../models/AppData').schema);

    const appData = await AppData.find({
      personnel_id: { $in: ids },               // or idsCast if casting
      date: { $gte: new Date(startDay), $lte: new Date(endDay) },
    })
    .sort({ date: 1 })
    .lean();

    return res.status(200).json(appData);
  } catch (error) {
    return res.status(500).json({
      message: 'Error fetching AppData',
      error: error.message,
    });
  }
};


const addWorkDay = async (req, res) => {
  try {
    const {personnel_id, user_ID, date, week } = req.body;
    const AppData = req.db.model('AppData', require('../models/AppData').schema);

    const newAppData = new AppData({
      personnel_id,
      user_ID,
      date,
      week,
      trip_status: 'not_started',
      start_trip_checklist: {},
      end_trip_checklist: {}
    });
    await newAppData.save();
    return res.status(201).json(newAppData);
  }
  catch (error) {
    return res.status(500).json({
      message: 'Error adding work day',
      error: error.message,
    });
  }
}

const deleteSchedule = async (req, res) => {
  try {
    const AppData = req.db.model('AppData', require('../models/AppData').schema);
    const DayInvoice = req.db.model('DayInvoice', require('../models/DayInvoice').schema);
    const WeeklyInvoice = req.db.model('WeeklyInvoice', require('../models/WeeklyInvoice').schema);

    // Schedule
    const schedule = await AppData.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    // DayInvoice
    const dayInvoice = await DayInvoice.findOne({
      personnelId: schedule.personnel_id,
      date: schedule.date
    });

    const week = schedule.week;
    const removeDate = new Date(schedule.date);
    const removeRate = dayInvoice ? dayInvoice.total : 0;

    // WeeklyInvoice
    const weeklyInvoiceRecord = await WeeklyInvoice.findOne({
      personnelId: schedule.personnel_id,
      week: week
    }).populate('personnelId');

    let updatedWeeklyInvoice = null;

    // WeeklyInvoice Update or Deletion
    if (weeklyInvoiceRecord && dayInvoice) {
      if (
        weeklyInvoiceRecord.invoices.length === 1 &&
        weeklyInvoiceRecord.invoices[0].toString() === dayInvoice._id.toString()
      ) {
        // Delete the entire weekly invoice
        await WeeklyInvoice.findByIdAndDelete(weeklyInvoiceRecord._id);
      } else {
        if (weeklyInvoiceRecord.total <= removeRate) {
          return res.status(500).json({
            message: 'Error deleting schedule, Weekly Invoice total goes below Zero'
          });
        }

        // Update weekly invoice
        weeklyInvoiceRecord.total -= removeRate;
        weeklyInvoiceRecord.invoices = weeklyInvoiceRecord.invoices.filter(
          inv => inv.toString() !== dayInvoice._id.toString()
        );

        if (weeklyInvoiceRecord.vatTotal) {
          const vatNo = weeklyInvoiceRecord.personnelId?.vatDetails?.vatNo;
          const eff = weeklyInvoiceRecord.personnelId?.vatDetails?.vatEffectiveDate;
          const vatEffectiveDate = eff instanceof Date ? eff : (eff ? new Date(eff) : null);

          const isVatRegisteredOnDay =
            Boolean(vatNo) && vatEffectiveDate && vatEffectiveDate <= removeDate;

          weeklyInvoiceRecord.vatTotal -= isVatRegisteredOnDay
            ? removeRate * 0.2
            : removeRate;
        }

        updatedWeeklyInvoice = await weeklyInvoiceRecord.save();
      }
    }

    // Delete DayInvoice and Schedule
    if (dayInvoice) {
      await DayInvoice.deleteOne({ _id: dayInvoice._id });
    }
    await AppData.deleteOne({ _id: schedule._id });

    sendToClients(req.db, {
      type: 'scheduleDeleted',
      data: schedule
    });

    res.json({
      message: 'Schedule and DayInvoice deleted, Weekly Invoice Updated',
      weeklyInvoice: updatedWeeklyInvoice
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting schedule', error: error.message });
  }
};

module.exports = { fetchAppData, addWorkDay, deleteSchedule };