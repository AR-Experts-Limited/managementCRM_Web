const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { fetchAppData, addWorkDay, deleteSchedule } = require('../controllers/liveOpsController');

router.post('/fetchappdata', fetchAppData);
router.post('/', addWorkDay);
router.delete('/:id', deleteSchedule);

module.exports = router;