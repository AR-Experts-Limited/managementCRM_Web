const express = require('express');
const router = express.Router();

const {
  updateLocation,
  getLocationData,
  requestLocation,
} = require('../controllers/applicationLocationController');

// Update Location
router.patch('/update-location', updateLocation);

// Get Location Data
router.get('/:user_ID', getLocationData);

// New request-location endpoint
router.post('/request-location', requestLocation);

module.exports = router;