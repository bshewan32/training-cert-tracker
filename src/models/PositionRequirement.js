// src/models/PositionRequirement.js
const mongoose = require('mongoose');

const PositionRequirementSchema = new mongoose.Schema({
  position: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Position',
    required: true 
  },
  certificateType: { 
    type: String, 
    required: true 
  },
  validityPeriod: { 
    type: Number, 
    default: 12,  // Default validity in months
    required: true 
  },
  isRequired: { 
    type: Boolean, 
    default: true 
  },
  active: { 
    type: Boolean, 
    default: true 
  },
  notes: { 
    type: String 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Unique compound index to prevent duplicates (one certificate type per position)
PositionRequirementSchema.index({ position: 1, certificateType: 1 }, { unique: true });

module.exports = mongoose.model('PositionRequirement', PositionRequirementSchema);