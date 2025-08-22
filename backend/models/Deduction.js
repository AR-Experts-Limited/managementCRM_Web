// models/Deduction.js
const mongoose = require('mongoose');

const DeductionSchema = new mongoose.Schema({
    role: { type: String, required: true },
    personnelId: { type: String, required: true },
    user_ID: { type: String, required: true },
    personnelName: { type: String, required: true },
    serviceType: { type: String, required: true },
    rate: { type: Number, required: true },
    date: { type: Date, required: true },
    deductionDocument: { type: String },
    addedBy: { type: Object },
    signed: { type: Boolean, required: true },
    week: { type: String },
});

const Deduction = mongoose.model('Deduction', DeductionSchema);
DeductionSchema.index({ driverId: 1, date: 1 })

module.exports = Deduction;
