// Enhanced ExcelTemplateUploader.jsx with DD/MM/YYYY date parsing
import { useState, useCallback } from 'react';
import { AlertCircle, FileUp, FileDown, Check, Info, Upload, X } from 'lucide-react';
import ImportPreview from './ImportPreview';
import * as XLSX from 'xlsx';

const ExcelTemplateUploader = ({ token, onSuccess, onError }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ type: null, message: '' });
  const [previewData, setPreviewData] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Parse DD/MM/YYYY date format
  const parseDate = (dateString) => {
    if (!dateString) return null;
    
    // Handle different date formats
    const dateStr = dateString.toString().trim();
    
    // Check if it's DD/MM/YYYY format
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
    
    // Try parsing as regular date
    const parsedDate = new Date(dateStr);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  // Format date for display as DD/MM/YYYY
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  // Handle file selection from input
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    processFile(selectedFile);
  };

  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  // Drag events
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Process the selected file
  const processFile = (selectedFile) => {
    if (!selectedFile) return;
    
    // Check file type
    const fileType = selectedFile.name.split('.').pop().toLowerCase();
    if (fileType !== 'xlsx' && fileType !== 'xls') {
      setUploadStatus({ 
        type: 'error', 
        message: 'Please select a valid Excel file (.xlsx or .xls)'
      });
      return;
    }
    
    // Check file size (5MB limit)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setUploadStatus({ 
        type: 'error', 
        message: 'File size exceeds 5MB limit'
      });
      return;
    }
    
    setFile(selectedFile);
    setUploadStatus({ type: null, message: '' });
    
    // Show preview of file name and size
    const fileSizeInMB = (selectedFile.size / 1024 / 1024).toFixed(2);
    setPreviewData({
      name: selectedFile.name,
      size: `${fileSizeInMB} MB`,
      type: selectedFile.type
    });
    
    // Parse the Excel file to show preview
    parseExcelFile(selectedFile);
  };

  // Parse Excel file content
  const parseExcelFile = (file) => {
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
        
        if (jsonData.length === 0) {
          setUploadStatus({ 
            type: 'error', 
            message: 'The file contains no data'
          });
          return;
        }
        
        // Validate required columns
        const requiredColumns = ['Name', 'Position Title', 'Type'];
        const missingColumns = [];
        
        for (const column of requiredColumns) {
          if (!Object.keys(jsonData[0]).includes(column)) {
            missingColumns.push(column);
          }
        }
        
        if (missingColumns.length > 0) {
          setUploadStatus({ 
            type: 'error', 
            message: `Missing required columns: ${missingColumns.join(', ')}`
          });
          return;
        }
        
        // Validate data and add flags for preview
        const validatedData = jsonData.map(row => {
          const issues = [];
          let hasIssues = false;
          
          // Check required fields
          if (!row.Name) {
            issues.push('Missing name');
            hasIssues = true;
          }
          
          if (!row['Position Title']) {
            issues.push('Missing position title');
            hasIssues = true;
          }
          
          if (!row.Type) {
            issues.push('Missing certificate type');
            hasIssues = true;
          }
          
          // Parse and validate dates with DD/MM/YYYY support
          let bookingDate = null;
          let expiryDate = null;
          
          if (row['Booking Date']) {
            bookingDate = parseDate(row['Booking Date']);
            if (!bookingDate) {
              issues.push('Invalid booking date format (use DD/MM/YYYY)');
              hasIssues = true;
            }
          }
          
          if (row['Expiry Date']) {
            expiryDate = parseDate(row['Expiry Date']);
            if (!expiryDate) {
              issues.push('Invalid expiry date format (use DD/MM/YYYY)');
              hasIssues = true;
            }
          }
          
          return {
            ...row,
            // Store parsed dates
            parsedBookingDate: bookingDate,
            parsedExpiryDate: expiryDate,
            // Format dates for display
            'Booking Date': bookingDate ? formatDate(bookingDate) : row['Booking Date'],
            'Expiry Date': expiryDate ? formatDate(expiryDate) : row['Expiry Date'],
            hasIssues,
            issues
          };
        });
        
        // Set the parsed data for preview
        setParsedData(validatedData);
        
        // Show preview if there's valid data
        const validRecords = validatedData.filter(row => !row.hasIssues);
        if (validRecords.length > 0) {
          setShowPreview(true);
        } else {
          setUploadStatus({ 
            type: 'error', 
            message: 'No valid records found in the file. Please check your data and try again.'
          });
        }
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        setUploadStatus({ 
          type: 'error', 
          message: 'Error parsing the Excel file. Please check the file format.'
        });
      }
    };
    
    reader.onerror = () => {
      setUploadStatus({ 
        type: 'error', 
        message: 'Error reading the file. Please try again.'
      });
    };
    
    reader.readAsArrayBuffer(file);
  };

  // Function to download the template with proper authentication
  const downloadTemplate = async () => {
    if (!token) {
      setUploadStatus({
        type: 'error',
        message: 'Authentication required. Please log in again.'
      });
      return;
    }

    setIsDownloading(true);
    setUploadStatus({ type: 'uploading', message: 'Downloading template...' });

    try {
      // Fetch with proper authorization header
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/template', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`Failed to download template (${response.status})`);
      }

      // Get file as blob
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'training_records_template.xlsx';
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setUploadStatus({ 
        type: 'success', 
        message: 'Template downloaded successfully!'
      });
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setUploadStatus({ type: null, message: '' });
      }, 3000);
      
    } catch (err) {
      console.error('Template download error:', err);
      setUploadStatus({ 
        type: 'error', 
        message: err.message || 'Failed to download template'
      });
      
      if (onError) {
        onError(err);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // Function to upload the file
  const uploadFile = async (dataToUpload) => {
    if (!file) {
      setUploadStatus({ 
        type: 'error', 
        message: 'Please select a file to upload' 
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: 'uploading', message: 'Uploading your data...' });
    setShowPreview(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/bulk-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to upload file');
      }

      setUploadStatus({ 
        type: 'success', 
        message: `Successfully imported ${result.stats?.processedCount || 'all'} records!` 
      });
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      // Reset file input after successful upload
      setFile(null);
      setPreviewData(null);
      setParsedData(null);
    } catch (err) {
      setUploadStatus({ 
        type: 'error', 
        message: err.message || 'An error occurred during upload' 
      });
      
      if (onError) {
        onError(err);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreviewCancel = () => {
    setShowPreview(false);
  };

  const handlePreviewConfirm = (validData) => {
    // Upload the file with validated data
    uploadFile(validData);
  };

  return (
    <div className="excel-uploader">
      {showPreview && parsedData ? (
        <ImportPreview 
          data={parsedData}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      ) : (
        <>
          <div className="uploader-header">
            <h3>Bulk Import Training Records</h3>
            <button 
              type="button" 
              className="help-button"
              onClick={() => setShowHelpModal(true)}
            >
              <Info size={20} />
            </button>
          </div>

          <div className="uploader-container">
            <div className="template-section">
              <div className="template-info">
                <h4>Step 1: Download Template</h4>
                <p>
                  Use our Excel template with the correct column headers for importing employee training certificates.
                </p>
              </div>
              <button 
                className="template-download-btn"
                disabled={isDownloading}
                onClick={downloadTemplate}
              >
                <FileDown size={20} />
                {isDownloading ? 'Downloading...' : 'Download Template'}
              </button>
            </div>

            <div className="upload-section">
              <div className="upload-info">
                <h4>Step 2: Upload Your Completed Excel File</h4>
                <p>
                  Fill in the template with your data, then upload it here.
                  Supports .xlsx and .xls files (max 5MB).
                </p>
              </div>

              <div 
                className={`file-drop-zone ${isDragging ? 'active' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <FileUp size={32} />
                <p>Drag & drop your Excel file here</p>
                <p>- or -</p>
                <input
                  type="file"
                  id="excelFile"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="file-input"
                />
                <label htmlFor="excelFile" className="file-upload-label">
                  Browse Files
                </label>
              </div>

              {previewData && (
                <div className="file-preview">
                  <div className="file-preview-header">
                    <div>
                      <p className="file-name">{previewData.name}</p>
                      <p className="file-size">{previewData.size}</p>
                    </div>
                    <button 
                      className="remove-file-btn"
                      onClick={() => {
                        setFile(null);
                        setPreviewData(null);
                        setParsedData(null);
                        setUploadStatus({ type: null, message: '' });
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  {parsedData && (
                    <button 
                      onClick={() => setShowPreview(true)} 
                      className="preview-button"
                    >
                      Preview Data
                    </button>
                  )}
                </div>
              )}

              {uploadStatus.type && (
                <div className={`upload-status ${uploadStatus.type}`}>
                  {uploadStatus.type === 'error' && <AlertCircle size={20} />}
                  {uploadStatus.type === 'success' && <Check size={20} />}
                  <span>{uploadStatus.message}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showHelpModal && (
        <div className="help-modal-overlay">
          <div className="help-modal">
            <h3>How to Import Training Records</h3>
            
            <div className="help-section">
              <h4>Required Columns</h4>
              <ul>
                <li><strong>Name</strong> - Full name of the employee</li>
                <li><strong>Position Title</strong> - Employee's position (will create if doesn't exist)</li>
                <li><strong>Department</strong> - Department the employee belongs to</li>
                <li><strong>Type</strong> - Type of certificate/training</li>
                <li><strong>Booking Date</strong> - Date training was completed (DD/MM/YYYY)</li>
                <li><strong>Expiry Date</strong> - Date when certification expires (DD/MM/YYYY)</li>
                <li><strong>Company</strong> - Company email address</li>
              </ul>
            </div>
            
            <div className="help-section">
              <h4>Tips for Successful Import</h4>
              <ul>
                <li>Use the provided template to ensure correct column headers</li>
                <li>Dates should be in DD/MM/YYYY format (e.g., 15/01/2025)</li>
                <li>All records will be validated before import</li>
                <li>Existing employees will be updated with new certificates</li>
                <li>New position titles and certificate types will be created automatically</li>
                <li>If expiry date is not provided, it will be calculated based on the certificate type's validity period</li>
              </ul>
            </div>

            <div className="help-section">
              <h4>Sample Data</h4>
              <div className="sample-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Position Title</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Booking Date</th>
                      <th>Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>John Smith</td>
                      <td>Senior Developer</td>
                      <td>Engineering</td>
                      <td>First Aid</td>
                      <td>15/01/2025</td>
                      <td>15/01/2026</td>
                    </tr>
                    <tr>
                      <td>Jane Doe</td>
                      <td>Project Manager</td>
                      <td>Operations</td>
                      <td>Fire Safety</td>
                      <td>20/02/2025</td>
                      <td>20/02/2026</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <button 
              className="close-modal-btn"
              onClick={() => setShowHelpModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .excel-uploader {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .uploader-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 20px;
        }
        
        .help-button {
          background: transparent;
          color: #4a5568;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 50%;
        }
        
        .help-button:hover {
          background-color: #f7fafc;
          color: #2d3748;
        }
        
        .uploader-container {
          padding: 20px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        
        @media (min-width: 768px) {
          .uploader-container {
            grid-template-columns: 1fr 1fr;
          }
        }
        
        .template-section, .upload-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          background: #f8fafc;
          border-radius: 6px;
        }
        
        .template-info, .upload-info {
          flex: 1;
        }
        
        h4 {
          margin-top: 0;
          color: #1e293b;
          font-size: 1.1rem;
        }
        
        p {
          color: #475569;
          margin-bottom: 0;
        }
        
        .template-download-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background-color: #0ea5e9;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          max-width: 200px;
        }
        
        .template-download-btn:hover:not(:disabled) {
          background-color: #0284c7;
        }
        
        .template-download-btn:disabled {
          background-color: #94a3b8;
          cursor: not-allowed;
        }
        
        .file-drop-zone {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          background-color: #f8fafc;
          border: 2px dashed #cbd5e1;
          border-radius: 6px;
          color: #64748b;
          transition: all 0.2s;
          cursor: pointer;
        }
        
        .file-drop-zone.active {
          background-color: #eff6ff;
          border-color: #3b82f6;
        }
        
        .file-drop-zone p {
          margin: 10px 0;
        }
        
        .file-input {
          width: 0.1px;
          height: 0.1px;
          opacity: 0;
          overflow: hidden;
          position: absolute;
          z-index: -1;
        }
        
        .file-upload-label {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #e2e8f0;
          color: #334155;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          margin-top: 10px;
        }
        
        .file-upload-label:hover {
          background-color: #cbd5e1;
        }
        
        .file-preview {
          margin-top: 12px;
          padding: 12px;
          background-color: #f1f5f9;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        
        .file-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .file-name {
          font-weight: 500;
          margin: 0;
          color: #1e293b;
        }
        
        .file-size {
          margin: 4px 0 0 0;
          font-size: 0.875rem;
          color: #64748b;
        }
        
        .remove-file-btn {
          background: transparent;
          color: #64748b;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 50%;
        }
        
        .remove-file-btn:hover {
          background-color: #e2e8f0;
          color: #334155;
        }
        
        .preview-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background-color: #4b5563;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 12px;
          font-weight: 500;
          cursor: pointer;
          margin-top: 12px;
          width: 100%;
          transition: background-color 0.2s;
        }
        
        .preview-button:hover {
          background-color: #374151;
        }
        
        .upload-status {
          margin-top: 16px;
          padding: 12px 16px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .upload-status.error {
          background-color: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fee2e2;
        }
        
        .upload-status.success {
          background-color: #f0fdf4;
          color: #166534;
          border: 1px solid #dcfce7;
        }
        
        .upload-status.uploading {
          background-color: #eff6ff;
          color: #1e40af;
          border: 1px solid #dbeafe;
        }
        
        .help-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .help-modal {
          background-color: white;
          border-radius: 8px;
          padding: 24px;
          width: 90%;
          max-width: 700px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        
        .help-section {
          margin-bottom: 20px;
        }
        
        .help-section h4 {
          margin-bottom: 12px;
          color: #0f172a;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
        }
        
        .help-section ul {
          margin: 0;
          padding-left: 20px;
        }
        
        .help-section li {
          margin-bottom: 8px;
          color: #334155;
        }
        
        .sample-table {
          overflow-x: auto;
          margin-top: 10px;
        }
        
        .sample-table table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        
        .sample-table th {
          background-color: #f1f5f9;
          text-align: left;
          padding: 8px 12px;
          color: #475569;
          border-bottom: 2px solid #e2e8f0;
        }
        
        .sample-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
        }
        
        .close-modal-btn {
          background-color: #4b5563;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          margin-top: 16px;
          cursor: pointer;
        }
        
        .close-modal-btn:hover {
          background-color: #374151;
        }
        
        @media (max-width: 768px) {
          .uploader-container {
            padding: 16px;
            gap: 16px;
          }
          
          .template-section, .upload-section {
            padding: 16px;
          }
          
          .file-upload-area {
            flex-direction: column;
            align-items: stretch;
          }
          
          .file-upload-label, .preview-button {
            width: 100%;
            text-align: center;
            justify-content: center;
          }
          
          .sample-table {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ExcelTemplateUploader;

// // Enhanced ExcelTemplateUploader.jsx with XLSX parsing and preview
// import { useState, useCallback } from 'react';
// import { AlertCircle, FileUp, FileDown, Check, Info, Upload, X } from 'lucide-react';
// import ImportPreview from './ImportPreview';
// import * as XLSX from 'xlsx';

// const ExcelTemplateUploader = ({ token, onSuccess, onError }) => {
//   const [file, setFile] = useState(null);
//   const [isUploading, setIsUploading] = useState(false);
//   const [isDownloading, setIsDownloading] = useState(false);
//   const [uploadStatus, setUploadStatus] = useState({ type: null, message: '' });
//   const [previewData, setPreviewData] = useState(null);
//   const [showHelpModal, setShowHelpModal] = useState(false);
//   const [parsedData, setParsedData] = useState(null);
//   const [showPreview, setShowPreview] = useState(false);
//   const [isDragging, setIsDragging] = useState(false);

//   // Handle file selection from input
//   const handleFileChange = (e) => {
//     const selectedFile = e.target.files[0];
//     processFile(selectedFile);
//   };

//   // Handle file drop
//   const handleDrop = useCallback((e) => {
//     e.preventDefault();
//     setIsDragging(false);
    
//     if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
//       processFile(e.dataTransfer.files[0]);
//     }
//   }, []);

//   // Drag events
//   const handleDragOver = useCallback((e) => {
//     e.preventDefault();
//     setIsDragging(true);
//   }, []);

//   const handleDragLeave = useCallback((e) => {
//     e.preventDefault();
//     setIsDragging(false);
//   }, []);

//   // Process the selected file
//   const processFile = (selectedFile) => {
//     if (!selectedFile) return;
    
//     // Check file type
//     const fileType = selectedFile.name.split('.').pop().toLowerCase();
//     if (fileType !== 'xlsx' && fileType !== 'xls') {
//       setUploadStatus({ 
//         type: 'error', 
//         message: 'Please select a valid Excel file (.xlsx or .xls)'
//       });
//       return;
//     }
    
//     // Check file size (5MB limit)
//     if (selectedFile.size > 5 * 1024 * 1024) {
//       setUploadStatus({ 
//         type: 'error', 
//         message: 'File size exceeds 5MB limit'
//       });
//       return;
//     }
    
//     setFile(selectedFile);
//     setUploadStatus({ type: null, message: '' });
    
//     // Show preview of file name and size
//     const fileSizeInMB = (selectedFile.size / 1024 / 1024).toFixed(2);
//     setPreviewData({
//       name: selectedFile.name,
//       size: `${fileSizeInMB} MB`,
//       type: selectedFile.type
//     });
    
//     // Parse the Excel file to show preview
//     parseExcelFile(selectedFile);
//   };

//   // Parse Excel file content
//   const parseExcelFile = (file) => {
//     const reader = new FileReader();
    
//     reader.onload = (e) => {
//       try {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
        
//         // Get the first sheet
//         const firstSheetName = workbook.SheetNames[0];
//         const worksheet = workbook.Sheets[firstSheetName];
        
//         // Convert to JSON
//         const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
//         if (jsonData.length === 0) {
//           setUploadStatus({ 
//             type: 'error', 
//             message: 'The file contains no data'
//           });
//           return;
//         }
        
//         // Validate required columns
//         const requiredColumns = ['Name', 'Position Title', 'Type'];
//         const missingColumns = [];
        
//         for (const column of requiredColumns) {
//           if (!Object.keys(jsonData[0]).includes(column)) {
//             missingColumns.push(column);
//           }
//         }
        
//         if (missingColumns.length > 0) {
//           setUploadStatus({ 
//             type: 'error', 
//             message: `Missing required columns: ${missingColumns.join(', ')}`
//           });
//           return;
//         }
        
//         // Validate data and add flags for preview
//         const validatedData = jsonData.map(row => {
//           const issues = [];
//           let hasIssues = false;
          
//           // Check required fields
//           if (!row.Name) {
//             issues.push('Missing name');
//             hasIssues = true;
//           }
          
//           if (!row['Position Title']) {
//             issues.push('Missing position title');
//             hasIssues = true;
//           }
          
//           if (!row.Type) {
//             issues.push('Missing certificate type');
//             hasIssues = true;
//           }
          
//           // Check date formats
//           if (row['Booking Date'] && isNaN(new Date(row['Booking Date']))) {
//             issues.push('Invalid booking date format');
//             hasIssues = true;
//           }
          
//           if (row['Expiry Date'] && isNaN(new Date(row['Expiry Date']))) {
//             issues.push('Invalid expiry date format');
//             hasIssues = true;
//           }
          
//           return {
//             ...row,
//             hasIssues,
//             issues
//           };
//         });
        
//         // Set the parsed data for preview
//         setParsedData(validatedData);
        
//         // Show preview if there's valid data
//         const validRecords = validatedData.filter(row => !row.hasIssues);
//         if (validRecords.length > 0) {
//           setShowPreview(true);
//         } else {
//           setUploadStatus({ 
//             type: 'error', 
//             message: 'No valid records found in the file. Please check your data and try again.'
//           });
//         }
//       } catch (error) {
//         console.error('Error parsing Excel file:', error);
//         setUploadStatus({ 
//           type: 'error', 
//           message: 'Error parsing the Excel file. Please check the file format.'
//         });
//       }
//     };
    
//     reader.onerror = () => {
//       setUploadStatus({ 
//         type: 'error', 
//         message: 'Error reading the file. Please try again.'
//       });
//     };
    
//     reader.readAsArrayBuffer(file);
//   };

//   // Function to download the template with proper authentication
//   const downloadTemplate = async () => {
//     if (!token) {
//       setUploadStatus({
//         type: 'error',
//         message: 'Authentication required. Please log in again.'
//       });
//       return;
//     }

//     setIsDownloading(true);
//     setUploadStatus({ type: 'uploading', message: 'Downloading template...' });

//     try {
//       // Fetch with proper authorization header
//       const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/template', {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${token}`
//         }
//       });

//       if (!response.ok) {
//         if (response.status === 401 || response.status === 403) {
//           throw new Error('Authentication failed. Please log in again.');
//         }
//         throw new Error(`Failed to download template (${response.status})`);
//       }

//       // Get file as blob
//       const blob = await response.blob();
      
//       // Create a download link
//       const url = window.URL.createObjectURL(blob);
//       const a = document.createElement('a');
//       a.style.display = 'none';
//       a.href = url;
//       a.download = 'training_records_template.xlsx';
      
//       // Trigger download
//       document.body.appendChild(a);
//       a.click();
      
//       // Cleanup
//       window.URL.revokeObjectURL(url);
//       document.body.removeChild(a);
      
//       setUploadStatus({ 
//         type: 'success', 
//         message: 'Template downloaded successfully!'
//       });
      
//       // Clear success message after a few seconds
//       setTimeout(() => {
//         setUploadStatus({ type: null, message: '' });
//       }, 3000);
      
//     } catch (err) {
//       console.error('Template download error:', err);
//       setUploadStatus({ 
//         type: 'error', 
//         message: err.message || 'Failed to download template'
//       });
      
//       if (onError) {
//         onError(err);
//       }
//     } finally {
//       setIsDownloading(false);
//     }
//   };

//   // Function to upload the file
//   const uploadFile = async (dataToUpload) => {
//     if (!file) {
//       setUploadStatus({ 
//         type: 'error', 
//         message: 'Please select a file to upload' 
//       });
//       return;
//     }

//     setIsUploading(true);
//     setUploadStatus({ type: 'uploading', message: 'Uploading your data...' });
//     setShowPreview(false);

//     try {
//       const formData = new FormData();
//       formData.append('file', file);

//       const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/bulk-upload', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`
//         },
//         body: formData
//       });

//       const result = await response.json();
      
//       if (!response.ok) {
//         throw new Error(result.message || 'Failed to upload file');
//       }

//       setUploadStatus({ 
//         type: 'success', 
//         message: `Successfully imported ${result.stats?.processedCount || 'all'} records!` 
//       });
      
//       if (onSuccess) {
//         onSuccess(result);
//       }
      
//       // Reset file input after successful upload
//       setFile(null);
//       setPreviewData(null);
//       setParsedData(null);
//     } catch (err) {
//       setUploadStatus({ 
//         type: 'error', 
//         message: err.message || 'An error occurred during upload' 
//       });
      
//       if (onError) {
//         onError(err);
//       }
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   const handlePreviewCancel = () => {
//     setShowPreview(false);
//   };

//   const handlePreviewConfirm = (validData) => {
//     // Upload the file with validated data
//     uploadFile(validData);
//   };

//   return (
//     <div className="excel-uploader">
//       {showPreview && parsedData ? (
//         <ImportPreview 
//           data={parsedData}
//           onConfirm={handlePreviewConfirm}
//           onCancel={handlePreviewCancel}
//         />
//       ) : (
//         <>
//           <div className="uploader-header">
//             <h3>Bulk Import Training Records</h3>
//             <button 
//               type="button" 
//               className="help-button"
//               onClick={() => setShowHelpModal(true)}
//             >
//               <Info size={20} />
//             </button>
//           </div>

//           <div className="uploader-container">
//             <div className="template-section">
//               <div className="template-info">
//                 <h4>Step 1: Download Template</h4>
//                 <p>
//                   Use our Excel template with the correct column headers for importing employee training certificates.
//                 </p>
//               </div>
//               <button 
//                 className="template-download-btn"
//                 disabled={isDownloading}
//                 onClick={downloadTemplate}
//               >
//                 <FileDown size={20} />
//                 {isDownloading ? 'Downloading...' : 'Download Template'}
//               </button>
//             </div>

//             <div className="upload-section">
//               <div className="upload-info">
//                 <h4>Step 2: Upload Your Completed Excel File</h4>
//                 <p>
//                   Fill in the template with your data, then upload it here.
//                   Supports .xlsx and .xls files (max 5MB).
//                 </p>
//               </div>

//               <div 
//                 className={`file-drop-zone ${isDragging ? 'active' : ''}`}
//                 onDrop={handleDrop}
//                 onDragOver={handleDragOver}
//                 onDragLeave={handleDragLeave}
//               >
//                 <FileUp size={32} />
//                 <p>Drag & drop your Excel file here</p>
//                 <p>- or -</p>
//                 <input
//                   type="file"
//                   id="excelFile"
//                   accept=".xlsx, .xls"
//                   onChange={handleFileChange}
//                   className="file-input"
//                 />
//                 <label htmlFor="excelFile" className="file-upload-label">
//                   Browse Files
//                 </label>
//               </div>

//               {previewData && (
//                 <div className="file-preview">
//                   <div className="file-preview-header">
//                     <div>
//                       <p className="file-name">{previewData.name}</p>
//                       <p className="file-size">{previewData.size}</p>
//                     </div>
//                     <button 
//                       className="remove-file-btn"
//                       onClick={() => {
//                         setFile(null);
//                         setPreviewData(null);
//                         setParsedData(null);
//                         setUploadStatus({ type: null, message: '' });
//                       }}
//                     >
//                       <X size={16} />
//                     </button>
//                   </div>
                  
//                   {parsedData && (
//                     <button 
//                       onClick={() => setShowPreview(true)} 
//                       className="preview-button"
//                     >
//                       Preview Data
//                     </button>
//                   )}
//                 </div>
//               )}

//               {uploadStatus.type && (
//                 <div className={`upload-status ${uploadStatus.type}`}>
//                   {uploadStatus.type === 'error' && <AlertCircle size={20} />}
//                   {uploadStatus.type === 'success' && <Check size={20} />}
//                   <span>{uploadStatus.message}</span>
//                 </div>
//               )}
//             </div>
//           </div>
//         </>
//       )}

//       {showHelpModal && (
//         <div className="help-modal-overlay">
//           <div className="help-modal">
//             <h3>How to Import Training Records</h3>
            
//             <div className="help-section">
//               <h4>Required Columns</h4>
//               <ul>
//                 <li><strong>Name</strong> - Full name of the employee</li>
//                 <li><strong>Position Title</strong> - Employee's position (will create if doesn't exist)</li>
//                 <li><strong>Department</strong> - Department the employee belongs to</li>
//                 <li><strong>Type</strong> - Type of certificate/training</li>
//                 <li><strong>Booking Date</strong> - Date training was completed (YYYY-MM-DD)</li>
//                 <li><strong>Expiry Date</strong> - Date when certification expires (YYYY-MM-DD)</li>
//                 <li><strong>Company</strong> - Company email address</li>
//               </ul>
//             </div>
            
//             <div className="help-section">
//               <h4>Tips for Successful Import</h4>
//               <ul>
//                 <li>Use the provided template to ensure correct column headers</li>
//                 <li>Dates should be in YYYY-MM-DD format</li>
//                 <li>All records will be validated before import</li>
//                 <li>Existing employees will be updated with new certificates</li>
//                 <li>New position titles and certificate types will be created automatically</li>
//                 <li>If expiry date is not provided, it will be calculated based on the certificate type's validity period</li>
//               </ul>
//             </div>

//             <div className="help-section">
//               <h4>Sample Data</h4>
//               <div className="sample-table">
//                 <table>
//                   <thead>
//                     <tr>
//                       <th>Name</th>
//                       <th>Position Title</th>
//                       <th>Department</th>
//                       <th>Type</th>
//                       <th>Booking Date</th>
//                       <th>Expiry Date</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     <tr>
//                       <td>John Smith</td>
//                       <td>Senior Developer</td>
//                       <td>Engineering</td>
//                       <td>First Aid</td>
//                       <td>2025-01-15</td>
//                       <td>2026-01-15</td>
//                     </tr>
//                     <tr>
//                       <td>Jane Doe</td>
//                       <td>Project Manager</td>
//                       <td>Operations</td>
//                       <td>Fire Safety</td>
//                       <td>2025-02-20</td>
//                       <td>2026-02-20</td>
//                     </tr>
//                   </tbody>
//                 </table>
//               </div>
//             </div>
            
//             <button 
//               className="close-modal-btn"
//               onClick={() => setShowHelpModal(false)}
//             >
//               Close
//             </button>
//           </div>
//         </div>
//       )}

//       <style jsx>{`
//         .excel-uploader {
//           background-color: white;
//           border-radius: 8px;
//           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
//           overflow: hidden;
//         }
        
//         .uploader-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           padding: 0 20px;
//         }
        
//         .help-button {
//           background: transparent;
//           color: #4a5568;
//           border: none;
//           cursor: pointer;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           padding: 8px;
//           border-radius: 50%;
//         }
        
//         .help-button:hover {
//           background-color: #f7fafc;
//           color: #2d3748;
//         }
        
//         .uploader-container {
//           padding: 20px;
//           display: grid;
//           grid-template-columns: 1fr;
//           gap: 24px;
//         }
        
//         @media (min-width: 768px) {
//           .uploader-container {
//             grid-template-columns: 1fr 1fr;
//           }
//         }
        
//         .template-section, .upload-section {
//           display: flex;
//           flex-direction: column;
//           gap: 16px;
//           padding: 20px;
//           background: #f8fafc;
//           border-radius: 6px;
//         }
        
//         .template-info, .upload-info {
//           flex: 1;
//         }
        
//         h4 {
//           margin-top: 0;
//           color: #1e293b;
//           font-size: 1.1rem;
//         }
        
//         p {
//           color: #475569;
//           margin-bottom: 0;
//         }
        
//         .template-download-btn {
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           gap: 8px;
//           background-color: #0ea5e9;
//           color: white;
//           border: none;
//           border-radius: 6px;
//           padding: 10px 16px;
//           font-weight: 500;
//           cursor: pointer;
//           transition: background-color 0.2s;
//           max-width: 200px;
//         }
        
//         .template-download-btn:hover:not(:disabled) {
//           background-color: #0284c7;
//         }
        
//         .template-download-btn:disabled {
//           background-color: #94a3b8;
//           cursor: not-allowed;
//         }
        
//         .file-drop-zone {
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           justify-content: center;
//           padding: 30px;
//           background-color: #f8fafc;
//           border: 2px dashed #cbd5e1;
//           border-radius: 6px;
//           color: #64748b;
//           transition: all 0.2s;
//           cursor: pointer;
//         }
        
//         .file-drop-zone.active {
//           background-color: #eff6ff;
//           border-color: #3b82f6;
//         }
        
//         .file-drop-zone p {
//           margin: 10px 0;
//         }
        
//         .file-input {
//           width: 0.1px;
//           height: 0.1px;
//           opacity: 0;
//           overflow: hidden;
//           position: absolute;
//           z-index: -1;
//         }
        
//         .file-upload-label {
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           background-color: #e2e8f0;
//           color: #334155;
//           padding: 10px 16px;
//           border-radius: 6px;
//           cursor: pointer;
//           font-weight: 500;
//           transition: all 0.2s;
//           margin-top: 10px;
//         }
        
//         .file-upload-label:hover {
//           background-color: #cbd5e1;
//         }
        
//         .file-preview {
//           margin-top: 12px;
//           padding: 12px;
//           background-color: #f1f5f9;
//           border-radius: 6px;
//           border: 1px solid #e2e8f0;
//         }
        
//         .file-preview-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//         }
        
//         .file-name {
//           font-weight: 500;
//           margin: 0;
//           color: #1e293b;
//         }
        
//         .file-size {
//           margin: 4px 0 0 0;
//           font-size: 0.875rem;
//           color: #64748b;
//         }
        
//         .remove-file-btn {
//           background: transparent;
//           color: #64748b;
//           border: none;
//           cursor: pointer;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           padding: 4px;
//           border-radius: 50%;
//         }
        
//         .remove-file-btn:hover {
//           background-color: #e2e8f0;
//           color: #334155;
//         }
        
//         .preview-button {
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           gap: 8px;
//           background-color: #4b5563;
//           color: white;
//           border: none;
//           border-radius: 6px;
//           padding: 8px 12px;
//           font-weight: 500;
//           cursor: pointer;
//           margin-top: 12px;
//           width: 100%;
//           transition: background-color 0.2s;
//         }
        
//         .preview-button:hover {
//           background-color: #374151;
//         }
        
//         .upload-status {
//           margin-top: 16px;
//           padding: 12px 16px;
//           border-radius: 6px;
//           display: flex;
//           align-items: center;
//           gap: 8px;
//         }
        
//         .upload-status.error {
//           background-color: #fef2f2;
//           color: #b91c1c;
//           border: 1px solid #fee2e2;
//         }
        
//         .upload-status.success {
//           background-color: #f0fdf4;
//           color: #166534;
//           border: 1px solid #dcfce7;
//         }
        
//         .upload-status.uploading {
//           background-color: #eff6ff;
//           color: #1e40af;
//           border: 1px solid #dbeafe;
//         }
        
//         .help-modal-overlay {
//           position: fixed;
//           top: 0;
//           left: 0;
//           right: 0;
//           bottom: 0;
//           background-color: rgba(0, 0, 0, 0.5);
//           display: flex;
//           justify-content: center;
//           align-items: center;
//           z-index: 1000;
//         }
        
//         .help-modal {
//           background-color: white;
//           border-radius: 8px;
//           padding: 24px;
//           width: 90%;
//           max-width: 700px;
//           max-height: 90vh;
//           overflow-y: auto;
//           box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
//         }
        
//         .help-section {
//           margin-bottom: 20px;
//         }
        
//         .help-section h4 {
//           margin-bottom: 12px;
//           color: #0f172a;
//           border-bottom: 1px solid #e2e8f0;
//           padding-bottom: 8px;
//         }
        
//         .help-section ul {
//           margin: 0;
//           padding-left: 20px;
//         }
        
//         .help-section li {
//           margin-bottom: 8px;
//           color: #334155;
//         }
        
//         .sample-table {
//           overflow-x: auto;
//           margin-top: 10px;
//         }
        
//         .sample-table table {
//           width: 100%;
//           border-collapse: collapse;
//           font-size: 0.875rem;
//         }
        
//         .sample-table th {
//           background-color: #f1f5f9;
//           text-align: left;
//           padding: 8px 12px;
//           color: #475569;
//           border-bottom: 2px solid #e2e8f0;
//         }
        
//         .sample-table td {
//           padding: 8px 12px;
//           border-bottom: 1px solid #e2e8f0;
//           color: #334155;
//         }
        
//         .close-modal-btn {
//           background-color: #4b5563;
//           color: white;
//           border: none;
//           border-radius: 6px;
//           padding: 10px 16px;
//           margin-top: 16px;
//           cursor: pointer;
//         }
        
//         .close-modal-btn:hover {
//           background-color: #374151;
//         }
        
//         @media (max-width: 768px) {
//           .uploader-container {
//             padding: 16px;
//             gap: 16px;
//           }
          
//           .template-section, .upload-section {
//             padding: 16px;
//           }
          
//           .file-upload-area {
//             flex-direction: column;
//             align-items: stretch;
//           }
          
//           .file-upload-label, .preview-button {
//             width: 100%;
//             text-align: center;
//             justify-content: center;
//           }
          
//           .sample-table {
//             max-width: 100%;
//           }
//         }
//       `}</style>
//     </div>
//   );
// };

// export default ExcelTemplateUploader;