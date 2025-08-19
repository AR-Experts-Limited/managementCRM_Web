const { uploadToS3 } = require('../utils/applications3Helper');

// Get a user's profile based on their user_ID
const getPersonnelProfile = async (req, res) => {
  const Personnel = req.db.model('Personnel', require('../models/Personnel').schema);
  const { user_ID } = req.params;

  try {
    const personnel = await Personnel.findOne({ user_ID });

    if (!personnel) {
      return res.status(404).json({ message: 'Personnel not found' });
    }

    const profileObject = personnel.toObject();

    // Process profile picture to send only the latest one
    if (profileObject.profilePicture?.length > 0) {
      const sortedPics = [...profileObject.profilePicture].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
      profileObject.profilePictureUrl = sortedPics[0]?.original || null;
    } else {
      profileObject.profilePictureUrl = null;
    }

    res.status(200).json(profileObject);
  } catch (error) {
    console.error('Error fetching personnel by user_ID:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

// Update a specific document for a user
const updatePersonnelDocument = async (req, res) => {
    const Personnel = req.db.model('Personnel', require('../models/Personnel').schema);
    try {
        const { user_ID } = req.params;
        const { documentType } = req.body;

        if (!documentType || !req.file) {
            return res.status(400).json({ message: "Document type and file are required." });
        }

        const personnel = await Personnel.findOne({ user_ID });
        if (!personnel) {
            return res.status(404).json({ message: "Personnel not found." });
        }

        const uploadResult = await uploadToS3(
            req.db.db.databaseName,
            req.file,
            personnel.user_ID,
            "personnel-documents", // S3 folder
            documentType
        );

        if (!uploadResult || !uploadResult.url) {
            return res.status(500).json({ message: "Failed to upload document to S3." });
        }

        const newVersion = {
            original: uploadResult.url,
            timestamp: new Date(),
            // Add other fields if needed for specific doc types
        };
        
        // Dynamically push to the correct document array
        if (!Array.isArray(personnel[documentType])) {
            personnel[documentType] = [];
        }
        personnel[documentType].push(newVersion);

        await personnel.save({ validateBeforeSave: false });

        res.status(200).json({ message: "Document uploaded successfully.", document: newVersion });

    } catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ message: "Server error while uploading document.", error: error.message });
    }
};


module.exports = {
  getPersonnelProfile,
  updatePersonnelDocument,
};