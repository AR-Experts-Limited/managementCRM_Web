const express = require('express');
const multer = require('multer');
// Add updateUserLocation to the import
const { getPersonnelProfile, updatePersonnelDocument } = require('../controllers/applicationProfileController');
const { updateUserLocation } = require('../controllers/applicationLocationController');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ... (existing routes are unchanged)
router.get('/user/:user_ID', getPersonnelProfile);
router.patch('/user/:user_ID/documents', upload.single('document'), updatePersonnelDocument);

// NEW ROUTE for location updates
router.patch('/user/location', updateUserLocation);

module.exports = router;