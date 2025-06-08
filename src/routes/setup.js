const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const Position = require('../models/Position');
const Employee = require('../models/Employee');
const Certificate = require('../models/Certificate');
const CertificateType = require('../models/CertificateType');
const { authenticateToken } = require('../controllers/middleware/auth');

// Configure multer storage for file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to parse DD/MM/YYYY dates
const parseDate = (dateString) => {
  if (!dateString) return null;
  
  const dateStr = dateString.toString().trim();
  
  // Handle DD/MM/YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      
      // Validate the parts
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
        return new Date(year, month - 1, day);
      }
    }
  }
  
  // Try parsing as regular date (handles YYYY-MM-DD and other formats)
  const parsedDate = new Date(dateStr);
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

// Enhanced bulk-upload endpoint
router.post('/bulk-upload', authenticateToken, upload.single('file'), async (req, res) => {
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
        employeeName: row['Name'].toString().trim(),
        employeeEmail: row['Company'] ? row['Company'].toString().trim() : '',
        certificateType: row['Type'].toString().trim(),
        positionTitle: row['Position Title'].toString().trim(),
        departmentName: row['Department'] ? row['Department'].toString().trim() : 'General',
        issueDate: null,
        expirationDate: null
      };
      
      // Process dates with DD/MM/YYYY support
      if (row['Booking Date']) {
        record.issueDate = parseDate(row['Booking Date']);
        if (!record.issueDate) {
          validationErrors.push(`Row ${index + 2}: Invalid Booking Date format for ${row['Name']} (use DD/MM/YYYY format, e.g., 15/01/2025)`);
          return;
        }
      } else {
        record.issueDate = new Date(); // Default to today
      }
      
      if (row['Expiry Date']) {
        record.expirationDate = parseDate(row['Expiry Date']);
        if (!record.expirationDate) {
          validationErrors.push(`Row ${index + 2}: Invalid Expiry Date format for ${row['Name']} (use DD/MM/YYYY format, e.g., 15/01/2026)`);
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
      newCertTypes: 0,
      errors: []
    };
    
    for (const record of processedRecords) {
      try {
        // Ensure Position Exists
        let position = await Position.findOne({ 
          title: { $regex: new RegExp(`^${record.positionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        });
        
        if (!position) {
          position = new Position({ 
            title: record.positionTitle, 
            department: record.departmentName 
          });
          await position.save();
          importStats.newPositions++;
        }

        // Check if employee exists, create if not (make sure they're active)
        let employee = await Employee.findOne({ 
          name: { $regex: new RegExp(`^${record.employeeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        });
        
        if (!employee) {
          employee = new Employee({
            name: record.employeeName,
            email: record.employeeEmail,
            positions: [position._id],
            primaryPosition: position._id,
            active: true // Ensure new employees are active
          });
          await employee.save();
          importStats.newEmployees++;
        } else {
          // Reactivate employee if they were archived
          let needsUpdate = false;
          
          if (!employee.active) {
            employee.active = true;
            needsUpdate = true;
          }
          
          // Update position if needed - check if position is already in positions array
          if (!employee.positions.some(pos => pos.toString() === position._id.toString())) {
            employee.positions.push(position._id);
            needsUpdate = true;
            
            // If no primary position is set, make this the primary
            if (!employee.primaryPosition) {
              employee.primaryPosition = position._id;
            }
          }
          
          if (record.employeeEmail && employee.email !== record.employeeEmail) {
            employee.email = record.employeeEmail;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            await employee.save();
          }
        }

        // Check if certificate type exists, create if not
        let certType = await CertificateType.findOne({ 
          name: { $regex: new RegExp(`^${record.certificateType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
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

        // Create the certificate - use correct field names for your schema
        const certificate = new Certificate({
          staffMember: employee.name,
          position: position._id, // Use ObjectId reference as per your schema
          certType: certType.name, // Use certType field as per your schema
          issueDate: record.issueDate,
          expirationDate: record.expirationDate
          // Don't set status - it will be set by pre-save hook
        });
        
        await certificate.save();
        importStats.processedCount++;
        
      } catch (recordError) {
        console.error(`Error processing record for ${record.employeeName}:`, recordError);
        importStats.errors.push(`Failed to process ${record.employeeName}: ${recordError.message}`);
      }
    }

    // Prepare response
    const response = { 
      message: `Successfully imported ${importStats.processedCount} of ${importStats.total} records`,
      stats: importStats
    };

    // Include errors if any occurred
    if (importStats.errors.length > 0) {
      response.partialSuccess = true;
      response.errors = importStats.errors;
    }

    res.json(response);
    
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ 
      message: 'Server error during bulk upload',
      error: error.message 
    });
  }
});

// Enhanced get setup data with active employee filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { includeInactive = 'false' } = req.query;
    
    const positions = await Position.find({ active: { $ne: false } }).sort({ title: 1 });
    
    // Filter employees based on active status
    const employeeFilter = includeInactive === 'true' ? {} : { active: { $ne: false } };
    const employees = await Employee.find(employeeFilter)
      .populate('positions primaryPosition')
      .sort({ name: 1 });
    
    const certificateTypes = await CertificateType.find({ active: { $ne: false } }).sort({ name: 1 });

    console.log(`Fetched ${employees.length} employees (includeInactive: ${includeInactive})`);

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

// Get archived employees specifically
router.get('/archived-employees', authenticateToken, async (req, res) => {
  try {
    const archivedEmployees = await Employee.find({ active: false })
      .populate('positions primaryPosition')
      .sort({ name: 1 });
    
    res.json({
      employees: archivedEmployees,
      count: archivedEmployees.length
    });
  } catch (error) {
    console.error('Error fetching archived employees:', error);
    res.status(500).json({ message: error.message });
  }
});

// Archive/Reactivate employee endpoints
router.put('/employee/:id/archive', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    ).populate('positions primaryPosition');
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    res.json({ 
      message: 'Employee archived successfully',
      employee: employee
    });
  } catch (error) {
    console.error('Error archiving employee:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/employee/:id/reactivate', authenticateToken, async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { active: true },
      { new: true }
    ).populate('positions primaryPosition');
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    res.json({ 
      message: 'Employee reactivated successfully',
      employee: employee
    });
  } catch (error) {
    console.error('Error reactivating employee:', error);
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
  router.post(`/${type}`, authenticateToken, async (req, res) => {
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
        // Populate positions and primaryPosition fields after saving
        item = await Employee.findById(item._id).populate('positions primaryPosition');
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
  router.put(`/${type}/:id`, authenticateToken, async (req, res) => {
    try {
      let item;
      if (type === 'employee') {
        // Special handling for employee
        item = await Model.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );
        // Populate the employee's positions and primaryPosition
        await item.populate('positions');
        await item.populate('primaryPosition');
      } else {
        item = await Model.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );
      }
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete (deactivate) item
  router.delete(`/${type}/:id`, authenticateToken, async (req, res) => {
    try {
      await Model.findByIdAndUpdate(req.params.id, { active: false });
      res.json({ message: 'Item deactivated successfully' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });
});

module.exports = router;

// // routes/setup.js - Updated version
// const express = require('express');
// const router = express.Router();
// const multer = require('multer');
// const XLSX = require('xlsx');
// const Position = require('../models/Position');
// const Employee = require('../models/Employee');
// const Certificate = require('../models/Certificate');
// const CertificateType = require('../models/CertificateType');

// // Configure multer storage for file uploads
// const storage = multer.memoryStorage(); // Store files in memory
// const upload = multer({ 
//   storage: storage,
//   limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
// });

// // Enhanced bulk-upload endpoint
// router.post('/bulk-upload', upload.single('file'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }
    
//     // Process the Excel file
//     const workbook = XLSX.read(req.file.buffer);
//     const sheetName = workbook.SheetNames[0];
//     const worksheet = workbook.Sheets[sheetName];
//     const rawData = XLSX.utils.sheet_to_json(worksheet);
    
//     // Validate required columns
//     const requiredColumns = ['Name', 'Position Title', 'Type'];
//     const missingColumns = [];
    
//     if (rawData.length === 0) {
//       return res.status(400).json({
//         message: 'The uploaded file contains no data. Please use the template provided.'
//       });
//     }
    
//     // Check if all required columns exist
//     for (const column of requiredColumns) {
//       if (!Object.keys(rawData[0]).includes(column)) {
//         missingColumns.push(column);
//       }
//     }
    
//     if (missingColumns.length > 0) {
//       return res.status(400).json({
//         message: `Missing required columns: ${missingColumns.join(', ')}. Please use the template provided.`
//       });
//     }
    
//     // Validate and prepare data for import
//     const processedRecords = [];
//     const validationErrors = [];
    
//     rawData.forEach((row, index) => {
//       // Skip empty rows
//       if (!row['Name'] || !row['Position Title'] || !row['Type']) {
//         return;
//       }
      
//       const record = {
//         employeeName: row['Name'],
//         employeeEmail: row['Company'] || '',
//         certificateType: row['Type'],
//         positionTitle: row['Position Title'],
//         departmentName: row['Department'] || 'General',
//         issueDate: null,
//         expirationDate: null
//       };
      
//       // Process dates
//       if (row['Booking Date']) {
//         try {
//           record.issueDate = new Date(row['Booking Date']);
//           if (isNaN(record.issueDate.getTime())) {
//             validationErrors.push(`Row ${index + 2}: Invalid Booking Date format for ${row['Name']}`);
//             return;
//           }
//         } catch (e) {
//           validationErrors.push(`Row ${index + 2}: Invalid Booking Date format for ${row['Name']}`);
//           return;
//         }
//       } else {
//         record.issueDate = new Date(); // Default to today
//       }
      
//       if (row['Expiry Date']) {
//         try {
//           record.expirationDate = new Date(row['Expiry Date']);
//           if (isNaN(record.expirationDate.getTime())) {
//             validationErrors.push(`Row ${index + 2}: Invalid Expiry Date format for ${row['Name']}`);
//             return;
//           }
//         } catch (e) {
//           validationErrors.push(`Row ${index + 2}: Invalid Expiry Date format for ${row['Name']}`);
//           return;
//         }
//       } else {
//         // If no expiry date provided, we'll set it later based on certificate type validity period
//         record.expirationDate = null;
//       }
      
//       processedRecords.push(record);
//     });
    
//     // Check if we have any validation errors
//     if (validationErrors.length > 0) {
//       return res.status(400).json({
//         message: 'Validation errors in the imported data',
//         errors: validationErrors
//       });
//     }
    
//     if (processedRecords.length === 0) {
//       return res.status(400).json({
//         message: 'No valid records found in the uploaded file'
//       });
//     }
    
//     // Start importing the validated records
//     const importStats = {
//       total: processedRecords.length,
//       processedCount: 0,
//       newPositions: 0,
//       newEmployees: 0,
//       newCertTypes: 0
//     };
    
//     for (const record of processedRecords) {
//       // Ensure Position Exists
//       let position = await Position.findOne({ 
//         title: { $regex: new RegExp(`^${record.positionTitle}$`, 'i') } 
//       });
      
//       if (!position) {
//         position = new Position({ 
//           title: record.positionTitle, 
//           department: record.departmentName 
//         });
//         await position.save();
//         importStats.newPositions++;
//       }

//       // Check if employee exists, create if not
//       let employee = await Employee.findOne({ 
//         name: { $regex: new RegExp(`^${record.employeeName}$`, 'i') } 
//       });
      
//       if (!employee) {
//         employee = new Employee({
//           name: record.employeeName,
//           email: record.employeeEmail,
//           positions: [position._id],
//           primaryPosition: position._id,
//           active: true
//         });
//         await employee.save();
//         importStats.newEmployees++;
//       } else {
//         // Update position if needed - check if position is already in positions array
//         if (!employee.positions.includes(position._id)) {
//           employee.positions.push(position._id);
          
//           // If no primary position is set, make this the primary
//           if (!employee.primaryPosition) {
//             employee.primaryPosition = position._id;
//           }
//         }
        
//         if (record.employeeEmail && employee.email !== record.employeeEmail) {
//           employee.email = record.employeeEmail;
//         }
//         await employee.save();
//       }

//       // Check if certificate type exists, create if not
//       let certType = await CertificateType.findOne({ 
//         name: { $regex: new RegExp(`^${record.certificateType}$`, 'i') } 
//       });
      
//       if (!certType) {
//         certType = new CertificateType({
//           name: record.certificateType,
//           validityPeriod: 12, // Default 12 months validity
//           active: true
//         });
//         await certType.save();
//         importStats.newCertTypes++;
//       }

//       // Set expiration date if not provided
//       if (!record.expirationDate) {
//         record.expirationDate = new Date(record.issueDate);
//         record.expirationDate.setMonth(
//           record.expirationDate.getMonth() + certType.validityPeriod
//         );
//       }

//       // Create the certificate
//       const certificate = new Certificate({
//         staffMember: employee.name,
//         position: position.title,
//         certificateType: certType.name,
//         issueDate: record.issueDate,
//         expirationDate: record.expirationDate,
//         status: 'Active' // Status will be set by pre-save hook
//       });
      
//       await certificate.save();
//       importStats.processedCount++;
//     }

//     res.json({ 
//       message: `Successfully imported ${importStats.processedCount} records`,
//       stats: importStats
//     });
    
//   } catch (error) {
//     console.error('Bulk upload error:', error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // Get setup data (existing route)
// router.get('/', async (req, res) => {
//   try {
//     const positions = await Position.find({ active: true });
//     // Update populate to match schema - populate positions and primaryPosition instead of position
//     const employees = await Employee.find({ active: true }).populate('positions primaryPosition');
//     const certificateTypes = await CertificateType.find({ active: true });

//     console.log('Fetched employees:', employees);

//     res.json({
//       positions,
//       employees,
//       certificateTypes
//     });
//   } catch (error) {
//     console.error('Setup route error:', error);
//     res.status(500).json({ message: error.message });
//   }
// });

// // The rest of your setup.js routes remain unchanged
// // Add routes for each model
// ['position', 'employee', 'certificateType'].forEach(type => {
//   const Model = {
//     position: Position,
//     employee: Employee,
//     certificateType: CertificateType
//   }[type];

//   // Add new item
//   router.post(`/${type}`, async (req, res) => {
//     try {
//       const itemData = {
//         ...req.body,
//         active: true  // Explicitly set active flag
//       };
      
//       let item;
//       if (type === 'employee') {
//         // Special handling for employee
//         item = new Model(itemData);
//         await item.save();
//         // Populate positions and primaryPosition fields after saving
//         item = await Employee.findById(item._id).populate('positions primaryPosition');
//       } else {
//         item = new Model(itemData);
//         await item.save();
//       }
      
//       console.log(`Created ${type}:`, item);
//       res.status(201).json(item);
//     } catch (error) {
//       console.error(`Error creating ${type}:`, error);
//       res.status(400).json({ message: error.message });
//     }
//   });

//   // Update item
//   router.put(`/${type}/:id`, async (req, res) => {
//     try {
//       let item;
//       if (type === 'employee') {
//         // Special handling for employee
//         item = await Model.findByIdAndUpdate(
//           req.params.id,
//           req.body,
//           { new: true }
//         );
//         // Populate the employee's positions and primaryPosition
//         await item.populate('positions');
//         await item.populate('primaryPosition');
//       } else {
//         item = await Model.findByIdAndUpdate(
//           req.params.id,
//           req.body,
//           { new: true }
//         );
//       }
//       res.json(item);
//     } catch (error) {
//       res.status(400).json({ message: error.message });
//     }
//   });

//   // Delete (deactivate) item
//   router.delete(`/${type}/:id`, async (req, res) => {
//     try {
//       await Model.findByIdAndUpdate(req.params.id, { active: false });
//       res.json({ message: 'Item deactivated successfully' });
//     } catch (error) {
//       res.status(400).json({ message: error.message });
//     }
//   });
// });

// module.exports = router;

