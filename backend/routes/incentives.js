const express = require('express');
const router = express.Router();
const { checkDayInvoice, fetchIncentives, fetchIncentiveByPersonnel, addIncentive, deleteIncentive } = require('../controllers/incentivesController');

router.get('/check-dayinvoice', checkDayInvoice);
router.get('/', fetchIncentives);
router.get('/personnel', fetchIncentiveByPersonnel);
router.post('/', addIncentive);
router.delete('/:id',deleteIncentive);

module.exports = router;