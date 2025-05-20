// src/components/ExcelExporter.jsx
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const ExcelExporter = ({ token }) => {
  const [certificates, setCertificates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [certificateTypes, setCertificateTypes] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filter states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [selectedCertType, setSelectedCertType] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('all'); // 'all', 'expiring', 'expired'
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Columns to include in export
  const [columnsToExport, setColumnsToExport] = useState({
    staffMember: true,
    position: true,
    certificateType: true,
    issueDate: true,
    expirationDate: true,
    status: true,
    email: false,
    department: false
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [token]);

  // Fetch all necessary data
  const fetchData = async () => {
    if (!token) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Fetch certificates
      const certResponse = await fetch('https://training-cert-tracker.onrender.com/api/certificates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!certResponse.ok) {
        throw new Error('Failed to fetch certificates');
      }
      
      const certData = await certResponse.json();
      setCertificates(certData);
      
      // Fetch setup data (employees, positions, certificate types)
      const setupResponse = await fetch('https://training-cert-tracker.onrender.com/api/setup', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!setupResponse.ok) {
        throw new Error('Failed to fetch setup data');
      }
      
      const setupData = await setupResponse.json();
      setEmployees(setupData.employees || []);
      setPositions(setupData.positions || []);
      setCertificateTypes(setupData.certificateTypes || []);
      
    } catch (err) {
      setError(err.message || 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  // Handle column selection
  const handleColumnToggle = (column) => {
    setColumnsToExport(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  // Filter certificates based on selected filters
  const getFilteredCertificates = () => {
    return certificates.filter(cert => {
      // Filter by employee
      if (selectedEmployeeId && cert.staffMember !== employees.find(e => e._id === selectedEmployeeId)?.name) {
        return false;
      }
      
      // Filter by position
      if (selectedPositionId) {
        const position = positions.find(p => p._id === selectedPositionId);
        if (position && cert.position !== position.title) {
          return false;
        }
      }
      
      // Filter by certificate type
      if (selectedCertType && cert.certificateType !== selectedCertType) {
        return false;
      }
      
      // Filter by expiry status
      if (expiryFilter !== 'all') {
        const now = new Date();
        const expiryDate = new Date(cert.expirationDate);
        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        if (expiryFilter === 'expired' && expiryDate > now) {
          return false;
        }
        
        if (expiryFilter === 'expiring' && (expiryDate <= now || expiryDate > thirtyDaysFromNow)) {
          return false;
        }
        
        if (expiryFilter === 'active' && expiryDate <= thirtyDaysFromNow) {
          return false;
        }
      }
      
      // Filter by date range (issue date)
      if (dateRange.start && new Date(cert.issueDate) < new Date(dateRange.start)) {
        return false;
      }
      
      if (dateRange.end && new Date(cert.issueDate) > new Date(dateRange.end)) {
        return false;
      }
      
      return true;
    });
  };

  // Export filtered certificates to Excel
  const exportToExcel = () => {
    const filteredCerts = getFilteredCertificates();
    
    if (filteredCerts.length === 0) {
      setError('No certificates match the selected filters');
      return;
    }
    
    // Format data for export
    const exportData = filteredCerts.map(cert => {
      // Find related employee
      const employee = employees.find(e => e.name === cert.staffMember) || {};
      
      // Find related position
      const position = positions.find(p => p.title === cert.position) || {};
      
      // Create the export object with only selected columns
      const exportObj = {};
      
      if (columnsToExport.staffMember) exportObj['Staff Member'] = cert.staffMember;
      if (columnsToExport.email) exportObj['Email'] = employee.email || '';
      if (columnsToExport.position) exportObj['Position'] = cert.position;
      if (columnsToExport.department) exportObj['Department'] = position.department || '';
      if (columnsToExport.certificateType) exportObj['Certificate Type'] = cert.certificateType;
      if (columnsToExport.issueDate) exportObj['Issue Date'] = formatDate(cert.issueDate);
      if (columnsToExport.expirationDate) exportObj['Expiration Date'] = formatDate(cert.expirationDate);
      if (columnsToExport.status) {
        // Calculate status
        const now = new Date();
        const expiryDate = new Date(cert.expirationDate);
        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        let status = 'Active';
        if (expiryDate <= now) {
          status = 'Expired';
        } else if (expiryDate <= thirtyDaysFromNow) {
          status = 'Expiring Soon';
        }
        
        exportObj['Status'] = status;
      }
      
      return exportObj;
    });
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Certificates');
    
    // Generate file name
    let fileName = 'certificates';
    
    if (selectedEmployeeId) {
      const employee = employees.find(e => e._id === selectedEmployeeId);
      if (employee) fileName += `_${employee.name.replace(/\s+/g, '_')}`;
    }
    
    if (selectedCertType) {
      fileName += `_${selectedCertType.replace(/\s+/g, '_')}`;
    }
    
    if (expiryFilter !== 'all') {
      fileName += `_${expiryFilter}`;
    }
    
    fileName += '.xlsx';
    
    // Export to file
    XLSX.writeFile(workbook, fileName);
    
    setSuccess(`Successfully exported ${filteredCerts.length} certificates to Excel.`);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccess('');
    }, 3000);
  };

  // Helper to format dates
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Refresh data
  const refreshData = () => {
    fetchData();
    setSuccess('Data refreshed successfully.');
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccess('');
    }, 3000);
  };

  return (
    <div className="excel-exporter">
      <h2>Export Certificates to Excel</h2>
      <p>Filter certificates and export them to Excel format.</p>
      
      <div className="exporter-container">
        <div className="filter-section">
          <h3>Filter Options</h3>
          
          <div className="filter-row">
            <div className="filter-group">
              <label>Employee:</label>
              <select 
                value={selectedEmployeeId} 
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Position:</label>
              <select 
                value={selectedPositionId} 
                onChange={(e) => setSelectedPositionId(e.target.value)}
              >
                <option value="">All Positions</option>
                {positions.map(pos => (
                  <option key={pos._id} value={pos._id}>{pos.title}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="filter-row">
            <div className="filter-group">
              <label>Certificate Type:</label>
              <select 
                value={selectedCertType} 
                onChange={(e) => setSelectedCertType(e.target.value)}
              >
                <option value="">All Certificate Types</option>
                {certificateTypes.map(type => (
                  <option key={type._id} value={type.name}>{type.name}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Status:</label>
              <select 
                value={expiryFilter} 
                onChange={(e) => setExpiryFilter(e.target.value)}
              >
                <option value="all">All Certificates</option>
                <option value="active">Active</option>
                <option value="expiring">Expiring Soon (30 days)</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
          
          <div className="filter-row">
            <div className="filter-group">
              <label>Issue Date Range:</label>
              <div className="date-range">
                <div className="date-input">
                  <label>From:</label>
                  <input 
                    type="date" 
                    value={dateRange.start} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="date-input">
                  <label>To:</label>
                  <input 
                    type="date" 
                    value={dateRange.end} 
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="column-section">
          <h3>Columns to Include</h3>
          <div className="column-checkboxes">
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="col-staffMember" 
                checked={columnsToExport.staffMember} 
                onChange={() => handleColumnToggle('staffMember')}
              />
              <label htmlFor="col-staffMember">Staff Member</label>
            </div>
            
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="col-email" 
                checked={columnsToExport.email} 
                onChange={() => handleColumnToggle('email')}
              />
              <label htmlFor="col-email">Email</label>
            </div>
            
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="col-position" 
                checked={columnsToExport.position} 
                onChange={() => handleColumnToggle('position')}
              />
              <label htmlFor="col-position">Position</label>
            </div>
            
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="col-department" 
                checked={columnsToExport.department} 
                onChange={() => handleColumnToggle('department')}
              />
              <label htmlFor="col-department">Department</label>
            </div>
            
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="col-certificateType" 
                checked={columnsToExport.certificateType} 
                onChange={() => handleColumnToggle('certificateType')}
              />
              <label htmlFor="col-certificateType">Certificate Type</label>
            </div>
            
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="col-issueDate" 
                checked={columnsToExport.issueDate} 
                onChange={() => handleColumnToggle('issueDate')}
              />
              <label htmlFor="col-issueDate">Issue Date</label>
            </div>
            
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="col-expirationDate" 
                checked={columnsToExport.expirationDate} 
                onChange={() => handleColumnToggle('expirationDate')}
              />
              <label htmlFor="col-expirationDate">Expiration Date</label>
            </div>
            
            <div className="checkbox-group">
              <input 
                type="checkbox" 
                id="col-status" 
                checked={columnsToExport.status} 
                onChange={() => handleColumnToggle('status')}
              />
              <label htmlFor="col-status">Status</label>
            </div>
          </div>
        </div>
        
        <div className="action-section">
          <div className="match-count">
            {!loading && (
              <p>
                <strong>Matching certificates:</strong> {getFilteredCertificates().length}
              </p>
            )}
          </div>
          
          <div className="button-group">
            <button 
              className="refresh-button" 
              onClick={refreshData}
              disabled={loading}
            >
              Refresh Data
            </button>
            
            <button 
              className="export-button" 
              onClick={exportToExcel}
              disabled={loading || getFilteredCertificates().length === 0}
            >
              Export to Excel
            </button>
          </div>
        </div>
        
        {loading && <div className="loading-message">Loading data...</div>}
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
      </div>
      
      <style jsx>{`
        .excel-exporter {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          max-width: 900px;
          margin: 20px auto;
          padding: 20px;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
          color: #2d3748;
          margin-top: 0;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        p {
          color: #4a5568;
          margin-bottom: 20px;
        }
        
        h3 {
          font-size: 1.1rem;
          color: #2d3748;
          margin-top: 0;
          margin-bottom: 15px;
        }
        
        .exporter-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .filter-section, .column-section, .action-section {
          background-color: #f7fafc;
          padding: 20px;
          border-radius: 6px;
        }
        
        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 15px;
        }
        
        .filter-row:last-child {
          margin-bottom: 0;
        }
        
        .filter-group {
          flex: 1;
          min-width: 200px;
        }
        
        .filter-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #4a5568;
        }
        
        .filter-group select, .filter-group input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .date-range {
          display: flex;
          gap: 10px;
        }
        
        .date-input {
          flex: 1;
        }
        
        .date-input label {
          font-weight: normal;
          font-size: 0.85rem;
        }
        
        .column-checkboxes {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
        }
        
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .checkbox-group input[type="checkbox"] {
          width: 16px;
          height: 16px;
        }
        
        .action-section {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
        }
        
        .match-count {
          font-size: 0.9rem;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
        }
        
        .export-button, .refresh-button {
          padding: 10px 16px;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .export-button {
          background-color: #3182ce;
          color: white;
        }
        
        .export-button:hover:not(:disabled) {
          background-color: #2c5282;
        }
        
        .refresh-button {
          background-color: #4a5568;
          color: white;
        }
        
        .refresh-button:hover:not(:disabled) {
          background-color: #2d3748;
        }
        
        .export-button:disabled, .refresh-button:disabled {
          background-color: #a0aec0;
          cursor: not-allowed;
        }
        
        .loading-message, .error-message, .success-message {
          padding: 10px 15px;
          border-radius: 4px;
          margin-top: 15px;
        }
        
        .loading-message {
          background-color: #ebf8ff;
          color: #2b6cb0;
        }
        
        .error-message {
          background-color: #fff5f5;
          color: #c53030;
        }
        
        .success-message {
          background-color: #f0fff4;
          color: #2f855a;
        }
        
        @media (max-width: 768px) {
          .excel-exporter {
            padding: 15px;
          }
          
          .filter-section, .column-section, .action-section {
            padding: 15px;
          }
          
          .filter-group {
            min-width: 100%;
          }
          
          .column-checkboxes {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          }
          
          .action-section {
            flex-direction: column;
            gap: 15px;
            align-items: flex-start;
          }
          
          .button-group {
            width: 100%;
          }
          
          .export-button, .refresh-button {
            flex: 1;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default ExcelExporter;