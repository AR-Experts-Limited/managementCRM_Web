// GET records from AppData
const fetchAppData = async (req, res) => {
  try {
    const { personnelId = "", startDay, endDay } = req.query;

    // Support comma-separated list or array of IDs
    const ids = Array.isArray(personnelId)
      ? personnelId
      : String(personnelId).split(',').map(s => s.trim()).filter(Boolean);

    if (!ids.length || !startDay || !endDay) {
      return res.status(400).json({
        message: "personnelId, startDay, and endDay are required",
      });
    }

    const AppData = req.db.model('AppData', require('../models/AppData').schema);

    const appData = await AppData.find({
      personnel_id: { $in: ids },
      date: { $gte: new Date(startDay), $lte: new Date(endDay) },
    })
    .sort({ date: 1 })  // optional: sort oldest → newest
    .lean();            // plain JS objects for faster reads

    return res.status(200).json(appData);
  } catch (error) {
    return res.status(500).json({
      message: 'Error fetching AppData',
      error: error.message,
    });
  }
}

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

module.exports = { fetchAppData, addWorkDay };