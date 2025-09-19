const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('./aws'); // Ensure this is configured
const { fetchWeeklyInvoices, updateWeeklyInvoice, updateDocument } = require('../controllers/weeklyInvoiceController');

const uploadDoc = multer({
    storage: multerS3({
        s3,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        key: (req, file, cb) => {
            const { personnelId, serviceWeek, user_ID, actionType } = req.body;
            const tenant = req.db.db.databaseName;
            const folder = actionType === 'sentInvoice' ? 'sent' : 'download';
            const filename = `${file.originalname}`;
            const key = `${tenant}/${user_ID}/payslips/${serviceWeek}/${folder}/${filename}`;
            cb(null, key);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: (req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        },
    }),
});

router.post('/', fetchWeeklyInvoices);
router.put('/update', updateWeeklyInvoice);
router.put('/document', uploadDoc.single('document'), updateDocument);

module.exports = router;