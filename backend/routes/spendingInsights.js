const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { addSpendingInsight, fetchProfitLoss, addProfitLoss }  = require('../controllers/spendingInsightsController');

// Route to fetch hours worked epr day and amount paid to specific Personnel
router.post('/', addProfitLoss);
router.get('/', fetchProfitLoss);

module.exports = router;