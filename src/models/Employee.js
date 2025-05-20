// models/Employee.js
const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Changed from single position to array of positions
  positions: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Position'
  }],
  // Keep a primary position for backward compatibility
  primaryPosition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Position'
  },
  email: { type: String },
  active: { type: Boolean, default: true }
});

// Pre-save middleware to ensure primaryPosition is set
EmployeeSchema.pre('save', function(next) {
  // If positions array has at least one position but primaryPosition isn't set
  if (this.positions && this.positions.length > 0 && !this.primaryPosition) {
    this.primaryPosition = this.positions[0]; // Set first position as primary
  }
  next();
});

module.exports = mongoose.model('Employee', EmployeeSchema);