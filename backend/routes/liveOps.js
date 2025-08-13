const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// GET records from AppData
router.get('/', async (req, res) => {
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
      personnelId: { $in: ids },
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
});
