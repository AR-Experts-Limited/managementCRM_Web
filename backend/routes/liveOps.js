const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { fetchAppData } = require('../controllers/liveOpsController');

router.get('/', fetchAppData);

module.exports = router;