const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const router = express.Router();
const s3 = require('./aws');
const moment = require('moment')
const mongoose = require('mongoose')
const { fetchAllPersonnels, fetchPersonnelbyId, fetchNiNumber, fetchPersonnelCount, fetchNotificationDetails, fetchPersonnelsBySite, addPersonnel, uploadVersion, uploadAdditionalVersion, deleteVersion, deleteAdditionalVersion, newUpdate, docUpdate, deletePersonnel, togglePersonnel } = require("../controllers/personnelsController");

// Multer S3 configuration
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    contentDisposition: 'inline',
    key: (req, file, cb) => {
      const databaseName = req.db.db.databaseName;
      const user_ID = req.body.user_ID;
      cb(null, `${databaseName}/${user_ID}/${file.fieldname}/${getFormattedDateTime()}/${file.originalname}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    if (allowedTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  },
});

// Utility functions
const getFormattedDateTime = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${day}${month}${year}_${hours}${minutes}${seconds}`;
};

// Error handling middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error(`Error in ${fn.name || 'route'}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  });
};

// Routes
router.get('/', asyncHandler(fetchAllPersonnels));
router.get('/ninumber', asyncHandler(fetchNiNumber));
router.get('/count', asyncHandler(fetchPersonnelCount));
router.get('/personnelbyid', asyncHandler(fetchPersonnelbyId));
router.get('/:siteSelection', asyncHandler(fetchPersonnelsBySite));
router.get('/notifications', asyncHandler(fetchNotificationDetails));
router.post('/', upload.any(), asyncHandler(addPersonnel));
router.post('/upload-version', upload.any(), asyncHandler(uploadVersion));
router.post('/upload-additional-version', upload.any(), asyncHandler(uploadAdditionalVersion));
router.post('/delete-version', asyncHandler(deleteVersion));
router.post('/delete-additional-version', asyncHandler(deleteAdditionalVersion));
router.put('/newupdate/:id', upload.any(), asyncHandler(newUpdate));
router.put('/docUpdate/:id', asyncHandler(docUpdate));
router.delete('/:id', asyncHandler(deletePersonnel));
router.post('/togglePersonnel/:id', asyncHandler(togglePersonnel));

module.exports = router;