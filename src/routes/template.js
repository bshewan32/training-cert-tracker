// routes/template.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/middleware/auth');
const fs = require('fs');
const path = require('path');
const { generateExcelTemplate } = require('../utils/excelTemplateGenerator');

// Route to download the template
router.get('/', authenticateToken, (req, res) => {
  try {
    // Generate the template
    const template = generateExcelTemplate();
    
    // Set response headers
    res.setHeader('Content-Disposition', 'attachment; filename=training_records_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Send the file buffer
    res.send(template.buffer);
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ message: 'Failed to generate template' });
  }
});

// Route to get info about required columns and format
router.get('/info', authenticateToken, (req, res) => {
  try {
    const templateInfo = {
      requiredColumns: [
        {
          name: 'Name',
          description: 'Full name of the employee',
          example: 'John Smith'
        },
        {
          name: 'Position Title',
          description: 'Employee\'s position (will create if doesn\'t exist)',
          example: 'Senior Developer'
        },
        {
          name: 'Type',
          description: 'Type of certificate/training',
          example: 'First Aid'
        }
      ],
      optionalColumns: [
        {
          name: 'Department',
          description: 'Department the employee belongs to',
          example: 'Engineering',
          default: 'General'
        },
        {
          name: 'Booking Date',
          description: 'Date training was completed',
          example: '2025-01-15',
          format: 'YYYY-MM-DD',
          default: 'Today\'s date'
        },
        {
          name: 'Expiry Date',
          description: 'Date when certification expires',
          example: '2026-01-15',
          format: 'YYYY-MM-DD',
          default: 'Calculated based on certificate type validity period'
        },
        {
          name: 'Company',
          description: 'Employee\'s email address',
          example: 'john.smith@company.com'
        }
      ],
      importInstructions: [
        "Don't change the column headers",
        "You can add as many rows as needed",
        "Existing employees will be updated with new certificates",
        "New positions and certificate types will be created automatically",
        "If expiry date is not provided, it will be calculated based on certificate type validity period"
      ]
    };
    
    res.json(templateInfo);
  } catch (error) {
    console.error('Template info error:', error);
    res.status(500).json({ message: 'Failed to get template information' });
  }
});

module.exports = router;