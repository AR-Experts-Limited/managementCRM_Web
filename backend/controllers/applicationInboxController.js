const Deduction = require('../models/Deduction');
const WeeklyInvoice = require('../models/WeeklyInvoice');

// GET all documents (deductions and invoices) for a specific user
const getDocuments = async (req, res) => {
    const Deduction = req.db.model('Deduction', require('../models/Deduction').schema);
    const WeeklyInvoice = req.db.model('WeeklyInvoice', require('../models/WeeklyInvoice').schema);

    try {
        const { user_ID } = req.params;
        if (!user_ID) {
            return res.status(400).json({ message: 'user_ID is required.' });
        }

        const deductions = await Deduction.find({ user_ID });
        const invoices = await WeeklyInvoice.find({ user_ID });

        // Format deductions into a consistent structure for the app
        const formattedDeductions = deductions.map(d => ({
            _id: d._id,
            docType: 'Deduction',
            title: 'Deduction Form',
            date: d.date,
            amount: d.rate,
            description: `Deduction of £${d.rate} for ${d.personnelName}`,
            signed: d.signed,
            url: d.signed ? d.deductionDocument : null,
        }));
        
        // Format sent invoices into the same structure
        const formattedInvoices = invoices.flatMap(inv => 
            (inv.sentInvoice || []).map(sent => ({
                _id: inv._id + '-' + sent.date, // Create a unique key
                docType: 'Invoice',
                title: `Invoice for Week ${inv.week}`,
                date: sent.date,
                amount: inv.total,
                signed: true, // Invoices are always considered signed/final
                url: sent.document,
            }))
        );

        // Combine and sort all documents by date
        const allDocuments = [...formattedDeductions, ...formattedInvoices];
        allDocuments.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json(allDocuments);
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ message: 'Error fetching documents' });
    }
};

// PATCH to sign a specific deduction
const signDeduction = async (req, res) => {
    const Deduction = req.db.model('Deduction', require('../models/Deduction').schema);
    try {
        const { id } = req.params;
        const { signature } = req.body;

        if (!signature) {
            return res.status(400).json({ message: 'Signature is required.' });
        }

        const deduction = await Deduction.findById(id);
        if (!deduction) {
            return res.status(404).json({ message: 'Deduction not found.' });
        }

        // Update the deduction status
        deduction.signed = true;
        // In a full implementation, you would generate a PDF and save its URL here
        // For now, we'll just mark it as signed.
        await deduction.save();

        res.status(200).json({ message: 'Deduction signed successfully.', deduction });
    } catch (error) {
        console.error('Error signing deduction:', error);
        res.status(500).json({ message: 'Error signing deduction' });
    }
};

module.exports = {
    getDocuments,
    signDeduction,
};