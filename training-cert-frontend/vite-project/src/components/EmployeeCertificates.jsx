import { useState, useEffect } from 'react';

const EmployeeCertificates = ({
  employee,
  certificates = [],
  certificateTypes = [],
  token,
  onCertificateAdded,
  onCertificateDeleted
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // New certificate form data
  const [newCertificate, setNewCertificate] = useState({
    certificateType: '',
    position: '',
    issueDate: '',
    expirationDate: ''
  });
  
  // Filter for displaying certificates
  const [positionFilter, setPositionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Get all employee positions from employee object
  const employeePositions = employee?.positions || [];
  
  // Reset form when employee changes
  useEffect(() => {
    resetForm();
  }, [employee]);
  
  // Calculate expiration date when certificate type or issue date changes
  useEffect(() => {
    if (newCertificate.certificateType && newCertificate.issueDate) {
      const selectedCertType = certificateTypes.find(
        cert => cert._id === newCertificate.certificateType
      );
      
      if (selectedCertType) {
        const issueDate = new Date(newCertificate.issueDate);
        const expiryDate = new Date(issueDate);
        expiryDate.setMonth(expiryDate.getMonth() + selectedCertType.validityPeriod);
        
        setNewCertificate(prev => ({
          ...prev,
          expirationDate: expiryDate.toISOString().split('T')[0]
        }));
      }
    }
  }, [newCertificate.certificateType, newCertificate.issueDate, certificateTypes]);
  
  // Reset form to defaults
  const resetForm = () => {
    setNewCertificate({
      certificateType: '',
      position: employee?.primaryPosition?._id || '',
      issueDate: new Date().toISOString().split('T')[0],
      expirationDate: ''
    });
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCertificate(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Submit new certificate
  const handleSubmit = async () => {
    // Validate form
    if (!newCertificate.certificateType || !newCertificate.position || !newCertificate.issueDate) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Get position title from the selected position ID
      const positionObj = employeePositions.find(pos => pos._id === newCertificate.position);
      
      if (!positionObj) {
        throw new Error('Position not found');
      }
      
      // Get certificate type name from ID
      const certTypeObj = certificateTypes.find(type => type._id === newCertificate.certificateType);
      
      if (!certTypeObj) {
        throw new Error('Certificate type not found');
      }
      
      // Prepare data for API
      const certificateData = {
        staffMember: employee.name,
        position: newCertificate.position,
        certificateType: certTypeObj.name,
        issueDate: newCertificate.issueDate,
        expirationDate: newCertificate.expirationDate
      };
      
      // Submit to API
      const response = await fetch('https://training-cert-tracker.onrender.com/api/certificates/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(certificateData),
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to add certificate');
      }
      
      const result = await response.json();
      
      setSuccess('Certificate added successfully!');
      resetForm();
      
      // Notify parent component
      if (onCertificateAdded) {
        onCertificateAdded(result);
      }
    } catch (err) {
      setError(err.message || 'Error adding certificate');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete certificate
  const handleDelete = async (certificateId) => {
    if (!confirm('Are you sure you want to delete this certificate?')) {
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/certificates/${certificateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to delete certificate');
      }
      
      setSuccess('Certificate deleted successfully!');
      
      // Notify parent component
      if (onCertificateDeleted) {
        onCertificateDeleted(certificateId);
      }
    } catch (err) {
      setError(err.message || 'Error deleting certificate');
    } finally {
      setLoading(false);
    }
  };
  
  // Filter certificates based on selection
  const filteredCertificates = certificates.filter(cert => {
    // Filter by position
    if (positionFilter !== 'all' && cert.position !== positionFilter) {
      return false;
    }
    
    // Filter by certificate type
    if (typeFilter !== 'all' && cert.certificateType !== typeFilter) {
      return false;
    }
    
    // Filter by status
    if (statusFilter !== 'all' && cert.status !== statusFilter) {
      return false;
    }
    
    return true;
  });
  
  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  // Get position name from ID
  const getPositionTitle = (positionId) => {
    const position = employeePositions.find(pos => pos._id === positionId);
    return position ? position.title : 'Unknown Position';
  };
  
  return (
    <div className="employee-certificates">
      <h3>Certificates for {employee?.name}</h3>
      
      {loading && <div className="loading-indicator">Loading...</div>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="certificates-container">
        {/* Add certificate form */}
        <div className="certificate-form">
          <h4>Add New Certificate</h4>
          
          <div className="form-group">
            <label>Position:</label>
            <select
              name="position"
              value={newCertificate.position}
              onChange={handleInputChange}
              required
            >
              <option value="">-- Select Position --</option>
              {employeePositions.map(pos => (
                <option key={pos._id} value={pos._id}>
                  {pos.title} {pos._id === employee?.primaryPosition?._id ? '(Primary)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Certificate Type:</label>
            <select
              name="certificateType"
              value={newCertificate.certificateType}
              onChange={handleInputChange}
              required
            >
              <option value="">-- Select Certificate Type --</option>
              {certificateTypes.map(cert => (
                <option key={cert._id} value={cert._id}>
                  {cert.name} ({cert.validityPeriod} months)
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Issue Date:</label>
            <input
              type="date"
              name="issueDate"
              value={newCertificate.issueDate}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Expiration Date:</label>
            <input
              type="date"
              name="expirationDate"
              value={newCertificate.expirationDate}
              readOnly
              className="readonly-input"
            />
            <small>Auto-calculated based on certificate type</small>
          </div>
          
          <div className="form-actions">
            <button
              type="button"
              className="submit-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              Add Certificate
            </button>
            <button
              type="button"
              className="reset-btn"
              onClick={resetForm}
              disabled={loading}
            >
              Reset
            </button>
          </div>
        </div>
        
        {/* Certificates list */}
        <div className="certificates-list">
          <h4>Current Certificates</h4>
          
          <div className="filters">
            <div className="filter-group">
              <label>Position:</label>
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
              >
                <option value="all">All Positions</option>
                {employeePositions.map(pos => (
                  <option key={pos._id} value={pos._id}>
                    {pos.title}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Type:</label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                {Array.from(new Set(certificates.map(cert => cert.certificateType))).map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Status:</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
          
          {filteredCertificates.length === 0 ? (
            <p className="no-certificates">No certificates found matching filters</p>
          ) : (
            <div className="table-container">
              <table className="certificates-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Certificate Type</th>
                    <th>Issue Date</th>
                    <th>Expiration Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCertificates.map(cert => (
                    <tr key={cert._id} className={`status-${cert.status.toLowerCase().replace(' ', '-')}`}>
                      <td>{getPositionTitle(cert.position)}</td>
                      <td>{cert.certificateType}</td>
                      <td>{formatDate(cert.issueDate)}</td>
                      <td>{formatDate(cert.expirationDate)}</td>
                      <td>
                        <span className={`status-badge ${cert.status.toLowerCase().replace(' ', '-')}`}>
                          {cert.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => handleDelete(cert._id)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .employee-certificates {
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        h3 {
          color: #2d3748;
          margin-top: 0;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        h4 {
          color: #2d3748;
          margin-top: 0;
          margin-bottom: 15px;
        }
        
        .certificates-container {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 20px;
          margin-top: 20px;
        }
        
        .certificate-form {
          background-color: #f7fafc;
          padding: 20px;
          border-radius: 6px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #4a5568;
        }
        
        .form-group input,
        .form-group select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .form-group .readonly-input {
          background-color: #edf2f7;
          color: #718096;
        }
        
        .form-group small {
          display: block;
          margin-top: 4px;
          color: #718096;
          font-size: 0.8rem;
        }
        
        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        .submit-btn {
          flex: 1;
          background-color: #4299e1;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .submit-btn:hover:not(:disabled) {
          background-color: #3182ce;
        }
        
        .reset-btn {
          flex: 1;
          background-color: #e2e8f0;
          color: #4a5568;
          border: none;
          border-radius: 4px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .reset-btn:hover:not(:disabled) {
          background-color: #cbd5e0;
        }
        
        .certificates-list {
          background-color: #f7fafc;
          padding: 20px;
          border-radius: 6px;
        }
        
        .filters {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        
        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .filter-group label {
          font-weight: 500;
          color: #4a5568;
          white-space: nowrap;
        }
        
        .filter-group select {
          padding: 6px 10px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .no-certificates {
          color: #718096;
          font-style: italic;
          padding: 20px 0;
          text-align: center;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        .certificates-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .certificates-table th {
          text-align: left;
          padding: 12px;
          background-color: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-bottom: 2px solid #cbd5e0;
        }
        
        .certificates-table td {
          padding: 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .certificates-table tr.status-active {
          background-color: #f0fff4;
        }
        
        .certificates-table tr.status-expiring-soon {
          background-color: #fffbeb;
        }
        
        .certificates-table tr.status-expired {
          background-color: #fff5f5;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .status-badge.active {
          background-color: #c6f6d5;
          color: #276749;
        }
        
        .status-badge.expiring-soon {
          background-color: #feebc8;
          color: #c05621;
        }
        
        .status-badge.expired {
          background-color: #fed7d7;
          color: #c53030;
        }
        
        .delete-btn {
          background-color: #f56565;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 0.8rem;
          cursor: pointer;
        }
        
        .delete-btn:hover:not(:disabled) {
          background-color: #e53e3e;
        }
        
        .loading-indicator {
          padding: 10px;
          color: #3182ce;
          text-align: center;
        }
        
        .error-message {
          padding: 10px;
          background-color: #fff5f5;
          color: #c53030;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .success-message {
          padding: 10px;
          background-color: #f0fff4;
          color: #2f855a;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        @media (max-width: 768px) {
          .certificates-container {
            grid-template-columns: 1fr;
          }
          
          .filters {
            flex-direction: column;
            gap: 10px;
          }
          
          .filter-group {
            width: 100%;
          }
          
          .filter-group select {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeeCertificates;