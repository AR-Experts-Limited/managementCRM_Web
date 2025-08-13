const express = require('express');
const router = express.Router();

// GET count of all unsigned documents for a specific user
router.get('/unsigned-documents/:user_ID', async (req, res) => {
    // Load models from the database connection provided by the middleware
    const Deduction = req.db.model('Deductions', require('../models/Deduction').schema);
    const AdditionalCharges = req.db.model('AdditionalCharges', require('../models/AdditionalCharges').schema);

    try {
        const { user_ID } = req.params;

        if (!user_ID) {
            return res.status(400).json({ message: 'user_ID is required.' });
        }

        // Run all count queries in parallel for better performance
        const [
            unsignedDeductions,
            unsignedAdditionalCharges
        ] = await Promise.all([
            Deduction.countDocuments({ user_ID, signed: false }),
            AdditionalCharges.countDocuments({ user_ID, signed: false })
        ]);

        res.status(200).json({
            unsignedDeductions,
            unsignedAdditionalCharges,
        });
    } catch (error) {
        console.error('Error fetching unsigned documents:', error);
        res.status(500).json({ message: 'Error fetching unsigned documents', error });
    }
});

module.exports = router;