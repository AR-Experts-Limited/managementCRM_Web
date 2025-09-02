const express = require('express');
const router = express.Router();
const { getDocuments, signDeduction } = require('../controllers/applicationInboxController');

// Route to get all documents for a user
router.get('/documents/:user_ID', getDocuments);

// Route to sign a deduction
router.patch('/deductions/:id/sign', signDeduction);

module.exports = router;