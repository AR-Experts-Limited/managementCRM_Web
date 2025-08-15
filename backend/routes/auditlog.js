const express = require('express');
const router = express.Router();
const { createAuditLog } = require('../controllers/auditLogController');

router.post('/', createAuditLog);

module.exports = router;