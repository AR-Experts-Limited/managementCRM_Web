const express = require('express');
const multer = require('multer'); // To handle file uploads
const router = express.Router();
const mongoose = require('mongoose');
const multerS3 = require('multer-s3');
const s3 = require('./aws'); // Optional: To delete files from file system

const { createAdditionalCharge, fetchAdditionalCharges, fetchAdditionalChargesByRolesWeek, deleteAdditionalCharge } = require('../controllers/additionalChargesController');

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
      const databaseName = req.db.db.databaseName;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const folderName = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_` +
        `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

      cb(null, `${databaseName}/AdditionalCharges/${user_ID}/AddedOn_${folderName}/${file.originalname}`);
    },
  }),
});

router.post('/', upload.any(), createAdditionalCharge);
router.get('/', fetchAdditionalCharges);
router.get('/by-roles-week', fetchAdditionalChargesByRolesWeek);
router.delete('/:id', deleteAdditionalCharge);

module.exports = router;