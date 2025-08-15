const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('./aws'); 
const { addDayInvoice, updateComments, updateDayInvoice, deleteDayInvoice, fetchDayInvoices, fetchDayInvoiceById, fetchDayInvoiceByPersonnelId, fetchDayInvoicesBySiteAndWeek, workingHours, uploadInvoice } = require('../controllers/dayInvoiceController');

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    contentDisposition: 'inline',
    key: (req, file, cb) => {
      const user_ID = req.body.user_ID;
      const databaseName = req.db.db.databaseName
      cb(null, `${databaseName}/${user_ID}/payslips/${file.originalname}`);
    },
  }),
});

router.post('/',addDayInvoice);
router.put('/comments', updateComments);
router.put('/:invoiceId', updateDayInvoice);
router.delete('/', deleteDayInvoice);
router.get('/', fetchDayInvoices);
router.get('/siteandweek-multi', fetchDayInvoicesBySiteAndWeek);
router.post('/workinghours', workingHours);
router.get('/personnel', fetchDayInvoiceByPersonnelId);
router.post('/uploadInvoice', upload.any(), uploadInvoice);
router.get('/dayInvoiceById/:id', fetchDayInvoiceById);

module.exports = router;