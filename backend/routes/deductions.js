const express = require('express');
const multer = require('multer'); // To handle file uploads
const router = express.Router();
const multerS3 = require('multer-s3');
const s3 = require('./aws'); // Optional: To delete files from file system
const { checkDayInvoice, addDeduction, deleteDeduction, fetchDeductions, fetchAllDeductionsForPersonnel, fetchDeductionBySiteWeek, fetchDeductionByPersonnelId, uploadDocument, deleteUpload } = require('../controllers/deductionsController');

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    contentDisposition: 'inline',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const user_ID = req.body.user_ID;
      const databaseName = req.db.db.databaseName;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const folderName = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
        `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

      cb(null, `${databaseName}/Deductions/${user_ID}/AddedOn_${folderName}/${file.originalname}`);
    },
  }),
});

router.get('/check-dayinvoice', checkDayInvoice);
router.post('/', upload.any(), addDeduction);
router.delete('/:id', deleteDeduction);
router.get('/', fetchDeductions);
router.get('/filter', fetchDeductionByPersonnelId);
router.get('/by-site-week', fetchDeductionBySiteWeek);
router.get('/personnelspecific', fetchAllDeductionsForPersonnel);
router.post('/docupload', upload.any(), uploadDocument);
router.post('/deleteupload', deleteUpload);

module.exports = router;