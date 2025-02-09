// routes/setup.js
const express = require('express');
const router = express.Router();
const Position = require('../models/Position');
const Employee = require('../models/Employee');
const CertificateType = require('../models/CertificateType');

// In your setup.js route
router.get('/', async (req, res) => {
  try {
    const positions = await Position.find({ active: true });
    const employees = await Employee.find({ active: true }).populate('position');
    const certificateTypes = await CertificateType.find({ active: true });

    console.log('Fetched employees:', employees); // Add this

    res.json({
      positions,
      employees,
      certificateTypes
    });
  } catch (error) {
    console.error('Setup route error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add routes for each model
['position', 'employee', 'certificateType'].forEach(type => {
  const Model = {
    position: Position,
    employee: Employee,
    certificateType: CertificateType
  }[type];

  // Add new item
  router.post(`/${type}`, async (req, res) => {
    try {
      const item = new Model(req.body);
      await item.save();
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update item
  router.put(`/${type}/:id`, async (req, res) => {
    try {
      const item = await Model.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete (deactivate) item
  router.delete(`/${type}/:id`, async (req, res) => {
    try {
      await Model.findByIdAndUpdate(req.params.id, { active: false });
      res.json({ message: 'Item deactivated successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
});

module.exports = router;