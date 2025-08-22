const mongoose = require('mongoose');

const AdditionalChargesSchema = new mongoose.Schema({
    personnelId: { type: String, required: true },
    personnelName: { type: String, required: true },
    user_ID: { type: String, required: true },
    role: { type: String, required: true },
    week: { type: String, required: true },
    title: { type: String, required: true },
    type: { type: String, required: true },
    rate: { type: Number, required: true },
    additionalChargeDocument: { type: String },
    signed: { type: Boolean, required: true, default: false }
})
AdditionalChargesSchema.index({ personnelId: 1, week: 1 });

const AdditionalCharges = mongoose.model('AdditionalCharges', AdditionalChargesSchema)

module.exports = AdditionalCharges