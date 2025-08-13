// models/appdata.js
const mongoose = require('mongoose');

const AppDataSchema = new mongoose.Schema({
    personnelId: { type: String, required: true },
    user_ID: { type: String, required: true }, 
    date: { type: Date, required: true },
    startShiftChecklist: {
      startShiftTimestamp: { type: Date },
      signed: { type: Boolean, default: false }, 
      signature: { type: String, default: "" }, 
      location: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
      
      images: {
        front: { type: String },
        back: { type: String },
        left: { type: String },
        right: { type: String },
        top: { type: String },
        bottom: { type: String },
        dashboardImage: { type: String },
        extra1: { type: String },
        extra2: { type: String },
        extra3: { type: String },
      },
    },
    endShiftChecklist: 
      {
        endShiftTimestamp: { type: Date },
        location: {
          latitude: { type: Number },
          longitude: { type: Number },
        },
        oneHourBreak: { type: Boolean },
        signed: { type: Boolean, default: false }, 
        signature: { type: String, default: "" }, 
        images: {
          e_front: { type: String },
          e_back: { type: String },
          e_left: { type: String },
          e_right: { type: String },
          e_top: { type: String },
          e_bottom: { type: String },
          e_dashboardImage: { type: String },
          e_extra1: { type: String },
          e_extra2: { type: String },
          e_extra3: { type: String },
        },
      },
  });

  const AppData = mongoose.models.AppData || mongoose.model("AppData", AppDataSchema);

module.exports = AppData;