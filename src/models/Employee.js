// models/Employee.js
const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  position: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Position',
    required: true 
  },
  email: { type: String }
});

module.exports = mongoose.model('Employee', EmployeeSchema);