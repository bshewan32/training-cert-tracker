const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Position = require('../models/Position');
const Employee = require('../models/Employee');
const Certificate = require('../models/Certificate');
const CertificateType = require('../models/CertificateType');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    for (const row of data) {
      const employeeName = row['Name'];
      const employeeEmail = row['Company'];
      const certificateType = row['Type'];
      const positionTitle = row['Position Title']; // ✅ Extract Position Title
      const departmentName = row['Department'] || 'General'; // ✅ Default to "General" if missing

      // Ensure Position Exists
      let position = await Position.findOne({ title: positionTitle });
      if (!position) {
        position = new Position({ title: positionTitle, department: departmentName });
        await position.save();
      }

      // Check if employee exists, create if not
      let employee = await Employee.findOne({ name: employeeName });
      if (!employee) {
        employee = new Employee({
          name: employeeName,
          email: employeeEmail,
          position: position._id,  // ✅ Assign Position by ID
          active: true
        });
        await employee.save();
      }

      // Check if certificate type exists, create if not
      let certType = await CertificateType.findOne({ name: certificateType });
      if (!certType) {
        certType = new CertificateType({
          name: certificateType,
          validityPeriod: 12,
          active: true
        });
        await certType.save();
      }

      // Create Certificate
      const certificate = new Certificate({
        staffMember: employeeName,
        certificateType: certType.name,
        issueDate: row['Booking Date'] || new Date(),
        expirationDate: row['Expiry Date'] || new Date(),
        status: 'Active'
      });
      await certificate.save();
    }

    res.json({ message: `Successfully imported ${data.length} records` });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

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
      const itemData = {
        ...req.body,
        active: true  // Explicitly set active flag
      };
      
      let item;
      if (type === 'employee') {
        // Special handling for employee
        item = new Model(itemData);
        await item.save();
        // Populate the position field after saving
        item = await Employee.findById(item._id).populate('position');
      } else {
        item = new Model(itemData);
        await item.save();
      }
      
      console.log(`Created ${type}:`, item);
      res.status(201).json(item);
    } catch (error) {
      console.error(`Error creating ${type}:`, error);
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