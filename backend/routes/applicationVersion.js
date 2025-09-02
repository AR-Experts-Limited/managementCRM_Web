const express = require('express');
const router = express.Router();

const { getAppVersion } = require('../controllers/applicationVersionController');

router.get('/app-version', getAppVersion);

module.exports = router;