const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { fetchAppData, addWorkDay } = require('../controllers/liveOpsController');

router.get('/', fetchAppData);
router.post('/', addWorkDay);

module.exports = router;