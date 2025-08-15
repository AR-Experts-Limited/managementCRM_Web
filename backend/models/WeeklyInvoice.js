const mongoose = require('mongoose');

const weeklyInvoiceSchema = new mongoose.Schema({
    personnelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Personnel',
        index: true,
    },
    user_ID: {
        type: String,
        required: true,
    },
    week: {
        type: String,
        required: true,
        index: true,
    },
    invoices: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DayInvoice',
            required: true
        },
    ],
    additionalChargesDetail: Array,
    count: Number,
    invoiceDetails: {
        invoiceGeneratedBy: String,
        invoiceGeneratedOn: Date,
        invoiceDoc: String
    },
    referenceNumber: String,
    vatTotal: Number,
    downloadInvoice: Array,
    sentInvoice: Array,
    total: Number,
});

// Compound index for uniqueness
weeklyInvoiceSchema.index({ driverId: 1, serviceWeek: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyInvoice', weeklyInvoiceSchema);