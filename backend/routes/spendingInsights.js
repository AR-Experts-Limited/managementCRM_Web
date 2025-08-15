const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { addSpendingInsight }  = require('../controllers/spendingInsightsController');

// Route to fetch hours worked epr day and amount paid to specific Personnel
router.post('/', addSpendingInsight);

module.exports = router;