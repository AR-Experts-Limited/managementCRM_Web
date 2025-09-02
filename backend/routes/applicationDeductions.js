// managementCRM_Web/backend/routes/applicationDeductions.js

const express = require('express');
const router = express.Router();
const { getDeductionDetails, signDeduction } = require('../controllers/applicationDeductionsController');

// Route to get a single deduction by its ID
router.get('/:id', getDeductionDetails);

// Route to sign a deduction and generate the final PDF
router.patch('/:id/sign', signDeduction);

module.exports = router;