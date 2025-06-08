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
  
  // Define column headers and example data with DD/MM/YYYY format
  const templateData = [
    // Example row 1
    {
      'Name': 'John Smith',
      'Position Title': 'Senior Developer',
      'Department': 'Engineering',
      'Type': 'First Aid',
      'Booking Date': '15/01/2025',
      'Expiry Date': '15/01/2026',
      'Company': 'john.smith@company.com'
    },
    // Example row 2
    {
      'Name': 'Jane Doe',
      'Position Title': 'Project Manager',
      'Department': 'Operations',
      'Type': 'Fire Safety',
      'Booking Date': '20/02/2025',
      'Expiry Date': '20/02/2026',
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
  
  // Add comments to the template
  if (!ws['!comments']) ws['!comments'] = {};
  ws['!comments']['A1'] = { author: 'System', text: 'Required: Full name of the employee' };
  ws['!comments']['B1'] = { author: 'System', text: 'Required: Employee\'s position title' };
  ws['!comments']['C1'] = { author: 'System', text: 'Optional: Department name' };
  ws['!comments']['D1'] = { author: 'System', text: 'Required: Type of certificate/training' };
  ws['!comments']['E1'] = { author: 'System', text: 'Optional: Date format DD/MM/YYYY (defaults to today)' };
  ws['!comments']['F1'] = { author: 'System', text: 'Optional: Date format DD/MM/YYYY (calculated if not provided)' };
  ws['!comments']['G1'] = { author: 'System', text: 'Optional: Employee\'s email address' };
  
  // Add formatting to indicate required fields
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellRef].s) ws[cellRef].s = {};
    
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
    ["Booking Date", "Date training was completed in DD/MM/YYYY format (defaults to today)"],
    ["Expiry Date", "Date when certification expires in DD/MM/YYYY format (calculated if not provided)"],
    ["Company", "Employee's email address"],
    [""],
    ["Date Format Examples:"],
    ["15/01/2025", "Correct format (DD/MM/YYYY)"],
    ["1/1/2025", "Also acceptable (D/M/YYYY)"],
    ["2025-01-15", "Will be converted from YYYY-MM-DD"],
    [""],
    ["Notes:"],
    ["1. Do not change the column headers"],
    ["2. You can add as many rows as needed"],
    ["3. Yellow cells indicate required fields"],
    ["4. Existing employees will be updated with new certificates"],
    ["5. If expiry date is not provided, it will be calculated based on certificate type"],
    ["6. Use DD/MM/YYYY format for dates (e.g., 15/01/2025)"],
    ["7. The system will validate all dates before import"]
  ];
  
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  
  // Set column widths for instructions
  wsInstructions['!cols'] = [
    { wch: 20 }, // First column
    { wch: 60 }  // Second column (description)
  ];
  
  // Add formatting to instructions sheet
  if (wsInstructions['A1']) {
    wsInstructions['A1'].s = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "center" }
    };
  }
  
  // Add section headers formatting
  ['A3', 'A8', 'A14', 'A19'].forEach(ref => {
    if (wsInstructions[ref]) {
      wsInstructions[ref].s = {
        font: { bold: true, sz: 12 }
      };
    }
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