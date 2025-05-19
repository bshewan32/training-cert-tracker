// utils/excelTemplateGenerator.js

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Ensure directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

/**
 * Generates an Excel template file for training certificate imports
 * @returns {Object} Object containing the file path and buffer of the generated template
 */
const generateExcelTemplate = () => {
  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Define column headers and example data
  const templateData = [
    // Example row 1
    {
      'Name': 'John Smith',
      'Position Title': 'Senior Developer',
      'Department': 'Engineering',
      'Type': 'First Aid',
      'Booking Date': '2025-01-15',
      'Expiry Date': '2026-01-15',
      'Company': 'john.smith@company.com'
    },
    // Example row 2
    {
      'Name': 'Jane Doe',
      'Position Title': 'Project Manager',
      'Department': 'Operations',
      'Type': 'Fire Safety',
      'Booking Date': '2025-02-20',
      'Expiry Date': '2026-02-20',
      'Company': 'jane.doe@company.com'
    },
    // Empty row for user to fill
    {
      'Name': '',
      'Position Title': '',
      'Department': '',
      'Type': '',
      'Booking Date': '',
      'Expiry Date': '',
      'Company': ''
    }
  ];
  
  // Create a new worksheet from the data
  const ws = XLSX.utils.json_to_sheet(templateData);
  
  // Set column widths for better readability
  const wscols = [
    { wch: 20 }, // Name
    { wch: 20 }, // Position Title
    { wch: 15 }, // Department
    { wch: 20 }, // Type
    { wch: 15 }, // Booking Date
    { wch: 15 }, // Expiry Date
    { wch: 30 }  // Company
  ];
  ws['!cols'] = wscols;
  
  // Add notes to the template
  ws['!comments'] = {
    A1: { author: 'System', text: 'Required: Full name of the employee' },
    B1: { author: 'System', text: 'Required: Employee\'s position title' },
    C1: { author: 'System', text: 'Optional: Department name' },
    D1: { author: 'System', text: 'Required: Type of certificate/training' },
    E1: { author: 'System', text: 'Optional: Date format YYYY-MM-DD (defaults to today)' },
    F1: { author: 'System', text: 'Optional: Date format YYYY-MM-DD (calculated if not provided)' },
    G1: { author: 'System', text: 'Optional: Employee\'s email address' }
  };
  
  // Add formatting to indicate required fields
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
    ws[cellRef].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "EFEFEF" } }
    };
    
    // Mark required columns with a different color
    if (C === 0 || C === 1 || C === 3) { // Name, Position, Type
      ws[cellRef].s.fill.fgColor.rgb = "FFEB9C";
    }
  }

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, "Training Records");
  
  // Add a second sheet with instructions
  const instructionsData = [
    ["Training Certificate Import - Instructions"],
    [""],
    ["Required Columns:"],
    ["Name", "Full name of the employee (required)"],
    ["Position Title", "Employee's position (required, will create if it doesn't exist)"],
    ["Type", "Type of certificate/training (required, will create if it doesn't exist)"],
    [""],
    ["Optional Columns:"],
    ["Department", "Department the employee belongs to (defaults to 'General')"],
    ["Booking Date", "Date training was completed in YYYY-MM-DD format (defaults to today)"],
    ["Expiry Date", "Date when certification expires in YYYY-MM-DD format (calculated if not provided)"],
    ["Company", "Employee's email address"],
    [""],
    ["Notes:"],
    ["1. Do not change the column headers"],
    ["2. You can add as many rows as needed"],
    ["3. Yellow cells indicate required fields"],
    ["4. Existing employees will be updated with new certificates"],
    ["5. If expiry date is not provided, it will be calculated based on certificate type"]
  ];
  
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  
  // Set column widths for instructions
  wsInstructions['!cols'] = [
    { wch: 20 }, // First column
    { wch: 60 }  // Second column (description)
  ];
  
  // Add formatting to instructions sheet
  wsInstructions['A1'].s = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center" }
  };
  
  // Add section headers formatting
  ['A3', 'A8', 'A14'].forEach(ref => {
    wsInstructions[ref].s = {
      font: { bold: true, sz: 12 }
    };
  });
  
  // Add the instructions sheet to the workbook
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
  
  // Ensure the uploads/templates directory exists
  const templatesDir = ensureDirectoryExists(path.join(__dirname, '../uploads/templates'));
  const filePath = path.join(templatesDir, 'training_records_template.xlsx');
  
  // Write the file to disk
  XLSX.writeFile(wb, filePath);
  
  // Also create a buffer for direct response
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  return {
    filePath,
    buffer
  };
};

module.exports = {
  generateExcelTemplate
};