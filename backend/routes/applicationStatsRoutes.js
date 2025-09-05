const express = require('express');
const router = express.Router();
const { getTripStats } = require('../controllers/applicationStatsController');

// Route to get all statistics for a specific user
router.get('/stats/:user_ID', getTripStats);

module.exports = router;
