// models/appdata.js
const mongoose = require('mongoose');

const AppDataSchema = new mongoose.Schema({
  personnel_id: { type: String, required: true },
  user_ID: { type: String, required: true },
  trip_status: {
    type: String,
    enum: ['in_progress', 'completed'],
    default: 'in_progress',
  },
  date: { type: Date, default: Date.now },
  start_trip_checklist: {
    time_and_date: { type: Date },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    signed: { type: Boolean, default: false },
    signature: { type: String }, // Added signature field
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
    miles: { type: Number },
  },
  end_trip_checklist: {
    time_and_date: { type: Date },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    signed: { type: Boolean, default: false },
    signature: { type: String }, // Added signature field
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
    miles: { type: Number },
    one_hour_break: { type: Boolean, default: false },
  },
});

const AppData = mongoose.models.AppData || mongoose.model('AppData', AppDataSchema);

module.exports = AppData;