// src/components/ExcelDateFormatter.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const ExcelDateFormatter = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [dateFormat, setDateFormat] = useState('yyyy/mm/dd');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validate file type
    const fileType = selectedFile.name.split('.').pop().toLowerCase();
    if (fileType !== 'xlsx' && fileType !== 'xls' && fileType !== 'csv') {
      setStatus({
        message: 'Please select a valid Excel file (.xlsx, .xls) or CSV file',
        type: 'error'
      });
      return;
    }

    setFile(selectedFile);
    setStatus({ message: 'File loaded. Please select a column to reformat.', type: 'info' });
    
    // Read file to get column headers
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Get headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length > 0) {
          const headers = jsonData[0];
          setColumns(headers);
          
          // Generate a preview of the data
          const previewData = jsonData.slice(1, 6).map(row => {
            const rowObj = {};
            headers.forEach((header, index) => {
              rowObj[header] = row[index] || '';
            });
            return rowObj;
          });
          
          setPreview({ headers, data: previewData });
        } else {
          setStatus({
            message: 'No data found in the file',
            type: 'error'
          });
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        setStatus({
          message: 'Error reading file. Please make sure it is a valid Excel or CSV file.',
          type: 'error'
        });
      }
    };
    
    reader.readAsArrayBuffer(selectedFile);
  };

  // Process the excel file and convert the selected column to the specified date format
  const processFile = () => {
    if (!file || !selectedColumn) {
      setStatus({
        message: 'Please select both a file and a column to reformat',
        type: 'error'
      });
      return;
    }

    setIsProcessing(true);
    setStatus({ message: 'Processing file...', type: 'info' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Format the dates in the selected column
        const formattedData = jsonData.map(row => {
          if (row[selectedColumn]) {
            try {
              // Try to parse the date (handles various input formats)
              const dateValue = row[selectedColumn];
              let parsedDate;
              
              // Handle different date input formats
              if (typeof dateValue === 'number') {
                // Excel stores dates as serial numbers
                parsedDate = XLSX.SSF.parse_date_code(dateValue);
              } else if (typeof dateValue === 'string') {
                // Try various date parsing approaches
                parsedDate = new Date(dateValue);
                
                // Check if date is valid
                if (isNaN(parsedDate.getTime())) {
                  // Try to parse with various formats
                  const parts = dateValue.split(/[-/.]/);
                  if (parts.length === 3) {
                    // Try interpreting as MM/DD/YYYY or DD/MM/YYYY
                    const tryFormats = [
                      new Date(`${parts[2]}-${parts[0]}-${parts[1]}`), // MM/DD/YYYY
                      new Date(`${parts[2]}-${parts[1]}-${parts[0]}`), // DD/MM/YYYY
                      new Date(`${parts[0]}-${parts[1]}-${parts[2]}`), // YYYY/MM/DD
                    ];
                    
                    for (const date of tryFormats) {
                      if (!isNaN(date.getTime())) {
                        parsedDate = date;
                        break;
                      }
                    }
                  }
                }
              }
              
              // If we successfully parsed the date, format it
              if (parsedDate && !isNaN(parsedDate.getTime ? parsedDate.getTime() : parsedDate)) {
                const year = parsedDate.getFullYear ? parsedDate.getFullYear() : parsedDate.y;
                // Month is 0-based in JS Date
                const month = (parsedDate.getMonth ? parsedDate.getMonth() + 1 : parsedDate.m).toString().padStart(2, '0');
                const day = (parsedDate.getDate ? parsedDate.getDate() : parsedDate.d).toString().padStart(2, '0');
                
                // Format based on user selection
                let formattedDate;
                switch (dateFormat) {
                  case 'yyyy/mm/dd':
                    formattedDate = `${year}/${month}/${day}`;
                    break;
                  case 'mm/dd/yyyy':
                    formattedDate = `${month}/${day}/${year}`;
                    break;
                  case 'dd/mm/yyyy':
                    formattedDate = `${day}/${month}/${year}`;
                    break;
                  case 'yyyy-mm-dd':
                    formattedDate = `${year}-${month}-${day}`;
                    break;
                  default:
                    formattedDate = `${year}/${month}/${day}`;
                }
                
                row[selectedColumn] = formattedDate;
              } else {
                // If we couldn't parse the date, keep the original value
                console.warn(`Couldn't parse date: ${dateValue}`);
              }
            } catch (error) {
              console.error('Error formatting date:', error);
            }
          }
          return row;
        });
        
        // Convert back to worksheet
        const newWorksheet = XLSX.utils.json_to_sheet(formattedData);
        
        // Create a new workbook
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Formatted Dates');
        
        // Generate Excel file
        const excelBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `formatted_${file.name}`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setStatus({
          message: `File processed successfully! The column "${selectedColumn}" has been reformatted to ${dateFormat} format.`,
          type: 'success'
        });
      } catch (error) {
        console.error('Error processing file:', error);
        setStatus({
          message: 'Error processing file. Please check that the selected column contains valid dates.',
          type: 'error'
        });
      } finally {
        setIsProcessing(false);
      }
    };
    
    reader.onerror = () => {
      setStatus({
        message: 'Error reading file',
        type: 'error'
      });
      setIsProcessing(false);
    };
    
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="excel-date-formatter">
      <h2>Excel Date Formatter</h2>
      <p>Convert date columns in your Excel file to your preferred format.</p>
      
      <div className="form-container">
        <div className="form-group">
          <label>Step 1: Select Excel File</label>
          <input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleFileChange} 
            className="file-input"
          />
        </div>
        
        {columns.length > 0 && (
          <div className="form-group">
            <label>Step 2: Select Column to Format</label>
            <select 
              value={selectedColumn} 
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="select-input"
            >
              <option value="">-- Select Column --</option>
              {columns.map((column, index) => (
                <option key={index} value={column}>{column}</option>
              ))}
            </select>
          </div>
        )}
        
        {selectedColumn && (
          <div className="form-group">
            <label>Step 3: Select Date Format</label>
            <select 
              value={dateFormat} 
              onChange={(e) => setDateFormat(e.target.value)}
              className="select-input"
            >
              <option value="yyyy/mm/dd">yyyy/mm/dd</option>
              <option value="mm/dd/yyyy">mm/dd/yyyy</option>
              <option value="dd/mm/yyyy">dd/mm/yyyy</option>
              <option value="yyyy-mm-dd">yyyy-mm-dd</option>
            </select>
          </div>
        )}
        
        {selectedColumn && (
          <div className="form-group">
            <label>Step 4: Process File</label>
            <button 
              onClick={processFile} 
              disabled={isProcessing}
              className="process-button"
            >
              {isProcessing ? 'Processing...' : 'Format Dates & Download'}
            </button>
          </div>
        )}
        
        {status.message && (
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
      
      {preview && (
        <div className="preview-container">
          <h3>Data Preview</h3>
          <p>Showing the first 5 rows of your data:</p>
          <div className="table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  {preview.headers.map((header, index) => (
                    <th key={index} className={header === selectedColumn ? 'selected-column' : ''}>
                      {header}
                      {header === selectedColumn && ' (Selected)'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {preview.headers.map((header, colIndex) => (
                      <td 
                        key={colIndex}
                        className={header === selectedColumn ? 'selected-column' : ''}
                      >
                        {row[header] !== undefined ? row[header].toString() : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelDateFormatter;