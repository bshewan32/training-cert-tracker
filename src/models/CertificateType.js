// models/CertificateType.js
const mongoose = require('mongoose');

const CertificateTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  validityPeriod: { type: Number }, // in months
  description: { type: String },
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('CertificateType', CertificateTypeSchema);