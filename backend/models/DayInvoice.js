const mongoose = require('mongoose');
const DeductionSchema = require('./Deduction').schema;
const IncentiveSchema = require('./Incentive').schema

const dayInvoiceSchema = new mongoose.Schema({
    personnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel', required: true },
    user_ID: { type: String, required: true },
    date: { type: Date, required: true },
    role: { type: String, required: true },
    week: { type: String, required: true },
    total: { type: Number, required: true },
    comments: { type: Object },
    invoiceNumber: { type: Number },
    referenceNumber: { type: Number }
}, { timestamps: true });

const DayInvoice = mongoose.model('DayInvoice', dayInvoiceSchema);

dayInvoiceSchema.index({ personnelId: 1, date: 1 }, { unique: true });
dayInvoiceSchema.index({ site: 1, week: 1 });
dayInvoiceSchema.index({ personnelId: 1, week: 1 });
dayInvoiceSchema.index({ week: 1 });

module.exports = DayInvoice;