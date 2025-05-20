// routes/setup.js - Updated version
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Position = require('../models/Position');
const Employee = require('../models/Employee');
const Certificate = require('../models/Certificate');
const CertificateType = require('../models/CertificateType');

// Configure multer storage for file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Enhanced bulk-upload endpoint
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Process the Excel file
    const workbook = XLSX.read(req.file.buffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    // Validate required columns
    const requiredColumns = ['Name', 'Position Title', 'Type'];
    const missingColumns = [];
    
    if (rawData.length === 0) {
      return res.status(400).json({
        message: 'The uploaded file contains no data. Please use the template provided.'
      });
    }
    
    // Check if all required columns exist
    for (const column of requiredColumns) {
      if (!Object.keys(rawData[0]).includes(column)) {
        missingColumns.push(column);
      }
    }
    
    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: `Missing required columns: ${missingColumns.join(', ')}. Please use the template provided.`
      });
    }
    
    // Validate and prepare data for import
    const processedRecords = [];
    const validationErrors = [];
    
    rawData.forEach((row, index) => {
      // Skip empty rows
      if (!row['Name'] || !row['Position Title'] || !row['Type']) {
        return;
      }
      
      const record = {
        employeeName: row['Name'],
        employeeEmail: row['Company'] || '',
        certificateType: row['Type'],
        positionTitle: row['Position Title'],
        departmentName: row['Department'] || 'General',
        issueDate: null,
        expirationDate: null
      };
      
      // Process dates
      if (row['Booking Date']) {
        try {
          record.issueDate = new Date(row['Booking Date']);
          if (isNaN(record.issueDate.getTime())) {
            validationErrors.push(`Row ${index + 2}: Invalid Booking Date format for ${row['Name']}`);
            return;
          }
        } catch (e) {
          validationErrors.push(`Row ${index + 2}: Invalid Booking Date format for ${row['Name']}`);
          return;
        }
      } else {
        record.issueDate = new Date(); // Default to today
      }
      
      if (row['Expiry Date']) {
        try {
          record.expirationDate = new Date(row['Expiry Date']);
          if (isNaN(record.expirationDate.getTime())) {
            validationErrors.push(`Row ${index + 2}: Invalid Expiry Date format for ${row['Name']}`);
            return;
          }
        } catch (e) {
          validationErrors.push(`Row ${index + 2}: Invalid Expiry Date format for ${row['Name']}`);
          return;
        }
      } else {
        // If no expiry date provided, we'll set it later based on certificate type validity period
        record.expirationDate = null;
      }
      
      processedRecords.push(record);
    });
    
    // Check if we have any validation errors
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Validation errors in the imported data',
        errors: validationErrors
      });
    }
    
    if (processedRecords.length === 0) {
      return res.status(400).json({
        message: 'No valid records found in the uploaded file'
      });
    }
    
    // Start importing the validated records
    const importStats = {
      total: processedRecords.length,
      processedCount: 0,
      newPositions: 0,
      newEmployees: 0,
      newCertTypes: 0
    };
    
    for (const record of processedRecords) {
      // Ensure Position Exists
      let position = await Position.findOne({ 
        title: { $regex: new RegExp(`^${record.positionTitle}$`, 'i') } 
      });
      
      if (!position) {
        position = new Position({ 
          title: record.positionTitle, 
          department: record.departmentName 
        });
        await position.save();
        importStats.newPositions++;
      }

      // Check if employee exists, create if not
      let employee = await Employee.findOne({ 
        name: { $regex: new RegExp(`^${record.employeeName}$`, 'i') } 
      });
      
      if (!employee) {
        employee = new Employee({
          name: record.employeeName,
          email: record.employeeEmail,
          position: position._id,
          active: true
        });
        await employee.save();
        importStats.newEmployees++;
      } else if (employee.position.toString() !== position._id.toString()) {
        // Update position if it has changed
        employee.position = position._id;
        if (record.employeeEmail && employee.email !== record.employeeEmail) {
          employee.email = record.employeeEmail;
        }
        await employee.save();
      }

      // Check if certificate type exists, create if not
      let certType = await CertificateType.findOne({ 
        name: { $regex: new RegExp(`^${record.certificateType}$`, 'i') } 
      });
      
      if (!certType) {
        certType = new CertificateType({
          name: record.certificateType,
          validityPeriod: 12, // Default 12 months validity
          active: true
        });
        await certType.save();
        importStats.newCertTypes++;
      }

      // Set expiration date if not provided
      if (!record.expirationDate) {
        record.expirationDate = new Date(record.issueDate);
        record.expirationDate.setMonth(
          record.expirationDate.getMonth() + certType.validityPeriod
        );
      }

      // Create the certificate
      const certificate = new Certificate({
        staffMember: employee.name,
        position: position.title,
        certificateType: certType.name,
        issueDate: record.issueDate,
        expirationDate: record.expirationDate,
        status: 'Active' // Status will be set by pre-save hook
      });
      
      await certificate.save();
      importStats.processedCount++;
    }

    res.json({ 
      message: `Successfully imported ${importStats.processedCount} records`,
      stats: importStats
    });
    
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get setup data (existing route)
router.get('/', async (req, res) => {
  try {
    const positions = await Position.find({ active: true });
    const employees = await Employee.find({ active: true }).populate('position');
    const certificateTypes = await CertificateType.find({ active: true });

    console.log('Fetched employees:', employees);

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

// The rest of your setup.js routes remain unchanged
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

