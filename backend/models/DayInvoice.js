const mongoose = require('mongoose');
const DeductionSchema = require('./Deduction').schema;
const IncentiveSchema = require('./Incentive').schema

const dayInvoiceSchema = new mongoose.Schema({
    personnelId: { type: String, required: true },
    user_ID: { type: String, required: true },
    personnelName: { type: String, required: true },
    personnelEmail: { type: String, required: true },
    date: { type: Date, required: true },
    role: { type: String, required: true },
    week: { type: String, required: true },
    incentiveDetail: {
      type: [DeductionSchema],
      default: []
    },
    deductionDetail: {
      type: [DeductionSchema],
      default: []
    },
    total: { type: Number, required: true },
    addedBy: { type: Object },
    modifiedBy: { type: Object },
    modifiedOn: { type: Date },
    invoiceDetails: {
        invoiceGeneratedBy: { type: String },
        invoiceGeneratedOn: { type: String },
        invoiceDoc: { type: String },
    },
    comments: { type: Object },
    invoiceNumber: { type: Number },
    referenceNumber: { type: Number }
});

const DayInvoice = mongoose.model('DayInvoice', dayInvoiceSchema);

dayInvoiceSchema.index({ personnelId: 1, date: 1 }, { unique: true });
dayInvoiceSchema.index({ site: 1, week: 1 });
dayInvoiceSchema.index({ personnelId: 1, week: 1 });
dayInvoiceSchema.index({ week: 1 });

module.exports = DayInvoice;