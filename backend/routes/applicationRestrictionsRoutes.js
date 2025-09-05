// managementCRM_Web/backend/routes/applicationRestrictionsRoutes.js

const express = require('express');
const router = express.Router();
const { checkRestrictions } = require('../controllers/applicationRestrictionsController');

router.get('/check-restrictions/:user_ID', checkRestrictions);

module.exports = router;