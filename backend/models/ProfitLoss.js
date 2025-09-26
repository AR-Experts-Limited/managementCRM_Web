const mongoose = require('mongoose');

const ProfitLossSchema = new mongoose.Schema({
    personnelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Personnel',
        index: true,
    },
    week: {
        type: String,
        required: true,
        index: true,
    },
    profitLoss: Number,
    revenue: Number,
    addedBy: Object,
  });
  
  const ProfitLoss = mongoose.model('ProfitLoss', ProfitLossSchema);

module.exports = ProfitLoss;