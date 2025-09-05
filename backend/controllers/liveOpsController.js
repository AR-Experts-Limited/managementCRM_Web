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
    const deletedSchedule = await AppData.findByIdAndDelete(req.params.id)
    sendToClients(req.db, {
      type: 'scheduleDeleted', // Custom event to signal data update
      data: deletedSchedule
    });
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting schedule', error: error.message });
  }
}

module.exports = { fetchAppData, addWorkDay, deleteSchedule };