const express = require('express');
const multer = require('multer');
const router = express.Router();

const {
  startTrip,
  endTrip,
  getAllTrips,
} = require('../controllers/applicationDataController');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.patch(
  '/start-trip/:trip_id',
  upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
    { name: 'left', maxCount: 1 },
    { name: 'right', maxCount: 1 },
    { name: 'top', maxCount: 1 },
    { name: 'bottom', maxCount: 1 },
    { name: 'dashboardImage', maxCount: 1 },
    { name: 'extra1', maxCount: 1 },
    { name: 'extra2', maxCount: 1 },
    { name: 'extra3', maxCount: 1 },
    { name: 'signature', maxCount: 1 }, // Added signature field
  ]),
  startTrip
);

router.patch(
  '/end-trip',
  upload.fields([
    { name: 'e_front', maxCount: 1 },
    { name: 'e_back', maxCount: 1 },
    { name: 'e_left', maxCount: 1 },
    { name: 'e_right', maxCount: 1 },
    { name: 'e_top', maxCount: 1 },
    { name: 'e_bottom', maxCount: 1 },
    { name: 'e_dashboardImage', maxCount: 1 },
    { name: 'e_extra1', maxCount: 1 },
    { name: 'e_extra2', maxCount: 1 },
    { name: 'e_extra3', maxCount: 1 },
    { name: 'signature', maxCount: 1 }, // Added signature field
  ]),
  endTrip
);

router.get('/trips/:user_ID', getAllTrips);

module.exports = router;
