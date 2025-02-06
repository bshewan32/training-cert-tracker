// models/Position.js
const mongoose = require('mongoose');

const PositionSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  department: { type: String },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Position', PositionSchema);





