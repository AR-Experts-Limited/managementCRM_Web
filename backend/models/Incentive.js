const mongoose = require('mongoose');

const incentiveSchema = new mongoose.Schema({
  role: { type: String },
  personnelId: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  type: { type: String },
  rate: { type: Number },
  addedBy: { type: Object },
});

const Incentive = mongoose.model('Incentive', incentiveSchema);

module.exports = Incentive;