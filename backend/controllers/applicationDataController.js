// const { uploadToS3 } = require('../utils/applications3Helper');
// const { sendToClients } = require('../utils/sseService');

// const startTrip = async (req, res) => {
//   const AppData = req.db.model('AppData', require('../models/appdata').schema);
//   try {
//     const { personnel_id, user_ID, latitude, longitude, miles, signed } = req.body;

//     if (signed !== 'true') {
//       return res.status(400).json({ message: 'Signature is required to start the trip.' });
//     }

//     const mandatoryImages = [];
//     const missingImages = mandatoryImages.filter((img) => !req.files[img]);

//     if (missingImages.length > 0) {
//       return res.status(400).json({
//         message: `Missing mandatory images: ${missingImages.join(', ')}`,
//       });
//     }

//     let signatureUrl = '';
//     // Check if a signature file was uploaded before processing it
//     if (req.files && req.files['signature'] && req.files['signature'][0]) {
//       const signatureFile = req.files['signature'][0];
//       const signatureUploadResult = await uploadToS3(req.db.db.databaseName, signatureFile, user_ID, 'start-trip-signatures', 'signature');
//       signatureUrl = signatureUploadResult.url;
//     }

//     const imageUrls = {};
//     if (req.files) {
//       for (const key in req.files) {
//         if (key !== 'signature' && req.files[key] && req.files[key][0]) {
//           const file = req.files[key][0];
//           const uploadResult = await uploadToS3(req.db.db.databaseName, file, user_ID, 'start-trip-images', key);
//           imageUrls[key] = uploadResult.url;
//         }
//       }
//     }

//     const newTrip = new AppData({
//       personnel_id,
//       user_ID,
//       trip_status: 'in_progress',
//       start_trip_checklist: {
//         time_and_date: new Date(),
//         location: {
//           latitude: parseFloat(latitude),
//           longitude: parseFloat(longitude),
//         },
//         signed: true,
//         signature: signatureUrl, // Save signature URL (will be empty if no file)
//         images: imageUrls,
//         miles: parseFloat(miles),
//       },
//     });

//     await newTrip.save();

//     sendToClients(req.db, {
//       type: 'trip_started',
//       data: newTrip,
//     });

//     res.status(201).json({ message: 'Trip started successfully.', trip: newTrip });
//   } catch (error) {
//     console.error('Error starting trip:', error);
//     res.status(500).json({ message: 'Error starting trip.', error: error.message });
//   }
// };

// const endTrip = async (req, res) => {
//   const AppData = req.db.model('AppData', require('../models/appdata').schema);
//   try {
//     const { trip_id, latitude, longitude, miles, signed, one_hour_break } = req.body;

//     if (signed !== 'true') {
//       return res.status(400).json({ message: 'Signature is required to end the trip.' });
//     }

//     if (one_hour_break !== 'true') {
//       return res.status(400).json({ message: 'One hour break is required to end the trip.' });
//     }

//     const trip = await AppData.findById(trip_id);
//     if (!trip) {
//       return res.status(404).json({ message: 'Trip not found.' });
//     }

//     const mandatoryImages = [];
//     const missingImages = mandatoryImages.filter((img) => !req.files[img]);

//     if (missingImages.length > 0) {
//       return res.status(400).json({
//         message: `Missing mandatory images: ${missingImages.join(', ')}`,
//       });
//     }

//     let signatureUrl = '';
//     // Check if a signature file was uploaded before processing it
//     if (req.files && req.files['signature'] && req.files['signature'][0]) {
//       const signatureFile = req.files['signature'][0];
//       const signatureUploadResult = await uploadToS3(req.db.db.databaseName, signatureFile, trip.user_ID, 'end-trip-signatures', 'signature');
//       signatureUrl = signatureUploadResult.url;
//     }

//     const imageUrls = {};
//     if (req.files) {
//       for (const key in req.files) {
//         if (key !== 'signature' && req.files[key] && req.files[key][0]) {
//           const file = req.files[key][0];
//           const uploadResult = await uploadToS3(req.db.db.databaseName, file, trip.user_ID, 'end-trip-images', key);
//           imageUrls[key] = uploadResult.url;
//         }
//       }
//     }

//     trip.trip_status = 'completed';
//     trip.end_trip_checklist = {
//       time_and_date: new Date(),
//       location: {
//         latitude: parseFloat(latitude),
//         longitude: parseFloat(longitude),
//       },
//       signed: true,
//       signature: signatureUrl, // Save signature URL (will be empty if no file)
//       images: imageUrls,
//       miles: parseFloat(miles),
//       one_hour_break: true,
//     };

//     await trip.save();

//     sendToClients(req.db, {
//       type: 'trip_ended',
//       data: trip,
//     });

//     res.status(200).json({ message: 'Trip ended successfully.', trip });
//   } catch (error) {
//     console.error('Error ending trip:', error);
//     res.status(500).json({ message: 'Error ending trip.', error: error.message });
//   }
// };

// const getAllTrips = async (req, res) => {
//   const AppData = req.db.model('AppData', require('../models/appdata').schema);
//   try {
//     const { user_ID } = req.params;
//     const { page = 1, limit = 10 } = req.query;

//     const trips = await AppData.find({ user_ID })
//       .sort({ date: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .exec();

//     const count = await AppData.countDocuments({ user_ID });

//     res.status(200).json({
//       trips,
//       totalPages: Math.ceil(count / limit),
//       currentPage: page,
//     });
//   } catch (error) {
//     console.error('Error fetching trips:', error);
//     res.status(500).json({ message: 'Error fetching trips.', error: error.message });
//   }
// };

// module.exports = {
//   startTrip,
//   endTrip,
//   getAllTrips,
// };


const { uploadToS3 } = require('../utils/applications3Helper');
const { sendToClients } = require('../utils/sseService');

const startTrip = async (req, res) => {
  const AppData = req.db.model('AppData', require('../models/appdata').schema);
  try {
    const { personnel_id, user_ID, latitude, longitude, miles, signed } = req.body;

    if (signed !== 'true') {
      return res.status(400).json({ message: 'Signature is required to start the trip.' });
    }

    // --- TEMPORARY BYPASS FOR S3 UPLOAD ---
    let signatureUrl = 'https://placeholder.url/signature.png'; // Placeholder URL
    const imageUrls = {};

    if (req.files) {
      // Create placeholder URLs for any files that were sent
      for (const key in req.files) {
        if (req.files[key] && req.files[key][0]) {
           imageUrls[key] = `https://placeholder.url/${key}.png`;
        }
      }
    }
    // --- END OF TEMPORARY BYPASS ---

    const newTrip = new AppData({
      personnel_id,
      user_ID,
      trip_status: 'in_progress',
      start_trip_checklist: {
        time_and_date: new Date(),
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
        signed: true,
        signature: signatureUrl, 
        images: imageUrls,
        miles: parseFloat(miles),
      },
    });

    await newTrip.save();

    sendToClients(req.db, {
      type: 'trip_started',
      data: newTrip,
    });

    res.status(201).json({ message: 'Trip started successfully.', trip: newTrip });
  } catch (error) {
    console.error('Error starting trip:', error);
    res.status(500).json({ message: 'Error starting trip.', error: error.message });
  }
};

const endTrip = async (req, res) => {
  const AppData = req.db.model('AppData', require('../models/appdata').schema);
  try {
    const { trip_id, latitude, longitude, miles, signed, one_hour_break } = req.body;

    if (signed !== 'true' || one_hour_break !== 'true') {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const trip = await AppData.findById(trip_id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    // --- TEMPORARY BYPASS FOR S3 UPLOAD ---
    let signatureUrl = 'https://placeholder.url/end-signature.png'; // Placeholder URL
    const imageUrls = {};

    if (req.files) {
      for (const key in req.files) {
        if (req.files[key] && req.files[key][0]) {
           imageUrls[key] = `https://placeholder.url/${key}.png`;
        }
      }
    }
    // --- END OF TEMPORARY BYPASS ---

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

const getAllTrips = async (req, res) => {
  const AppData = req.db.model('AppData', require('../models/appdata').schema);
  try {
    const { user_ID } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const trips = await AppData.find({ user_ID })
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await AppData.countDocuments({ user_ID });

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