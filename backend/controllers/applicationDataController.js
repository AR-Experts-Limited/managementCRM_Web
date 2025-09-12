const { uploadToS3 } = require('../utils/applications3Helper');
const { sendToClients } = require('../utils/sseService');

/**
 * Starts a trip by updating a pre-created shift document.
 * It finds a shift by its ID, validates its status, updates it with the start-of-trip checklist data,
 * and changes its status to 'in_progress'.
 */
const startTrip = async (req, res) => {
  const AppData = req.db.model('AppData', require('../models/AppData').schema);
  try {
    const { trip_id } = req.params; 
    const { latitude, longitude, miles, signed } = req.body;

    if (signed !== 'true') {
      return res.status(400).json({ message: 'Signature is required to start the trip.' });
    }

    const trip = await AppData.findById(trip_id);
    if (!trip) {
        return res.status(404).json({ message: "Shift not found." });
    }
    if (trip.trip_status !== 'not_started') {
        return res.status(400).json({ message: "This shift has already been started or completed."});
    }

    let signatureUrl = '';
    if (req.files && req.files['signature'] && req.files['signature'][0]) {
      const signatureFile = req.files['signature'][0];
      const signatureUploadResult = await uploadToS3(req.db.db.databaseName, signatureFile, trip.user_ID, 'start-trip-signatures', 'signature');
      signatureUrl = signatureUploadResult.url;
    }

    const imageUrls = {};
    if (req.files) {
      for (const key in req.files) {
        if (key !== 'signature' && req.files[key] && req.files[key][0]) {
          const file = req.files[key][0];
          const uploadResult = await uploadToS3(req.db.db.databaseName, file, trip.user_ID, 'start-trip-images', key);
          imageUrls[key] = uploadResult.url;
        }
      }
    }

    // Update the existing shift document
    trip.trip_status = 'in_progress';
    trip.start_trip_checklist = {
        time_and_date: new Date(),
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
        signed: true,
        signature: signatureUrl,
        images: imageUrls,
        miles: parseFloat(miles),
    };

    const updatedTrip = await trip.save();

    sendToClients(req.db, {
      type: 'trip_started',
      data: updatedTrip,
    });

    res.status(200).json({ message: 'Trip started successfully.', trip: updatedTrip });
  } catch (error) {
    console.error('Error starting trip:', error);
    res.status(500).json({ message: 'Error starting trip.', error: error.message });
  }
};

/**
 * Ends an in-progress trip.
 * It finds the trip by its ID and updates it with the end-of-trip checklist data,
 * changing its status to 'completed'.
 */
const endTrip = async (req, res) => {
  const AppData = req.db.model('AppData', require('../models/AppData').schema);
  try {
    const { trip_id, latitude, longitude, miles, signed, one_hour_break } = req.body;

    if (signed !== 'true' || one_hour_break !== 'true') {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const trip = await AppData.findById(trip_id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    let signatureUrl = '';
    if (req.files && req.files['signature'] && req.files['signature'][0]) {
      const signatureFile = req.files['signature'][0];
      const signatureUploadResult = await uploadToS3(req.db.db.databaseName, signatureFile, trip.user_ID, 'end-trip-signatures', 'signature');
      signatureUrl = signatureUploadResult.url;
    }

    const imageUrls = {};
    if (req.files) {
      for (const key in req.files) {
        if (key !== 'signature' && req.files[key] && req.files[key][0]) {
          const file = req.files[key][0];
          const uploadResult = await uploadToS3(req.db.db.databaseName, file, trip.user_ID, 'end-trip-images', key);
          imageUrls[key] = uploadResult.url;
        }
      }
    }

    trip.trip_status = 'completed';
    trip.end_trip_checklist = {
      time_and_date: new Date(),
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
      signed: true,
      signature: signatureUrl,
      images: imageUrls,
      miles: parseFloat(miles),
      one_hour_break: true,
    };

    await trip.save();

    sendToClients(req.db, {
      type: 'trip_ended',
      data: trip,
    });

    res.status(200).json({ message: 'Trip ended successfully.', trip });
  } catch (error) {
    console.error('Error ending trip:', error);
    res.status(500).json({ message: 'Error ending trip.', error: error.message });
  }
};

/**
 * Fetches trip history for a user with support for filtering and pagination.
 * Can filter by date range (for calendar view) or a single date and status.
 */
const getAllTrips = async (req, res) => {
  const AppData = req.db.model('AppData', require('../models/AppData').schema);
  try {
    const { user_ID } = req.params;
    const { page = 1, limit = 10, date, status, startDate, endDate } = req.query;

    let query = { user_ID };

    if (date) {
        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate && endDate) {
        query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    if (status) {
        query.trip_status = status;
    }

    const trips = await AppData.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await AppData.countDocuments(query);

    res.status(200).json({
      trips,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Error fetching trips.', error: error.message });
  }
};

module.exports = {
  startTrip,
  endTrip,
  getAllTrips,
};

