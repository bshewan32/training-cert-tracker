import { useState, useEffect } from 'react';

const CertificateForm = ({
  token,
  employees = [],
  positions = [],
  certificateTypes = [],
  onCertificateAdded,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    staffMember: '',
    position: '',
    certificateType: '',
    issueDate: new Date().toISOString().split('T')[0],
    expirationDate: ''
  });
  
  // Selected employee's positions
  const [employeePositions, setEmployeePositions] = useState([]);
  
  // Update employee positions when employee changes
  useEffect(() => {
    if (formData.staffMember) {
      const selectedEmployee = employees.find(emp => emp._id === formData.staffMember);
      if (selectedEmployee && selectedEmployee.positions) {
        // Get full position objects
        const positionObjects = selectedEmployee.positions.map(posId => {
          const posObj = positions.find(p => p._id === (typeof posId === 'object' ? posId._id : posId));
          return posObj || null;
        }).filter(Boolean);
        
        setEmployeePositions(positionObjects);
        
        // Set default position to primary position if available
        if (selectedEmployee.primaryPosition && !formData.position) {
          const primaryPosId = typeof selectedEmployee.primaryPosition === 'object' 
            ? selectedEmployee.primaryPosition._id 
            : selectedEmployee.primaryPosition;
            
          setFormData(prev => ({
            ...prev,
            position: primaryPosId
          }));
        }
      } else {
        setEmployeePositions([]);
      }
    } else {
      setEmployeePositions([]);
    }
  }, [formData.staffMember, employees, positions]);
  
  // Calculate expiration date when certificate type or issue date changes
  useEffect(() => {
    if (formData.certificateType && formData.issueDate) {
      const selectedCertType = certificateTypes.find(
        cert => cert._id === formData.certificateType
      );
      
      if (selectedCertType) {
        const issueDate = new Date(formData.issueDate);
        const expiryDate = new Date(issueDate);
        expiryDate.setMonth(expiryDate.getMonth() + selectedCertType.validityPeriod);
        
        setFormData(prev => ({
          ...prev,
          expirationDate: expiryDate.toISOString().split('T')[0]
        }));
      }
    }
  }, [formData.certificateType, formData.issueDate, certificateTypes]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Reset position when employee changes
    if (name === 'staffMember') {
      setFormData(prev => ({
        ...prev,
        position: ''
      }));
    }
  };
  
  // Reset form to defaults
  const resetForm = () => {
    setFormData({
      staffMember: '',
      position: '',
      certificateType: '',
      issueDate: new Date().toISOString().split('T')[0],
      expirationDate: ''
    });
    setError('');
    setSuccess('');
  };
  
  // Submit form
  const handleSubmit = async () => {
    // Validate form
    if (!formData.staffMember || !formData.position || !formData.certificateType || !formData.issueDate) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Get employee name from ID
      const employee = employees.find(emp => emp._id === formData.staffMember);
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      // Get certificate type name from ID
      const certType = certificateTypes.find(cert => cert._id === formData.certificateType);
      if (!certType) {
        throw new Error('Certificate type not found');
      }
      
      // Prepare data for API
      const certificateData = {
        staffMember: employee.name,
        position: formData.position,
        certificateType: certType.name,
        issueDate: formData.issueDate,
        expirationDate: formData.expirationDate
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
  
  return (
    <div className="certificate-form-container">
      <h3>Add New Certificate</h3>
      
      {loading && <div className="loading-indicator">Processing...</div>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="form-content">
        <div className="form-group">
          <label htmlFor="staffMember">Employee:</label>
          <select
            id="staffMember"
            name="staffMember"
            value={formData.staffMember}
            onChange={handleInputChange}
            required
          >
            <option value="">-- Select Employee --</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="position">Position:</label>
          <select
            id="position"
            name="position"
            value={formData.position}
            onChange={handleInputChange}
            required
            disabled={!formData.staffMember || employeePositions.length === 0}
          >
            <option value="">-- Select Position --</option>
            {employeePositions.map(pos => {
              const isPrimary = employees.find(emp => emp._id === formData.staffMember)?.primaryPosition === pos._id;
              return (
                <option key={pos._id} value={pos._id}>
                  {pos.title} {isPrimary ? '(Primary)' : ''}
                </option>
              );
            })}
          </select>
          {formData.staffMember && employeePositions.length === 0 && (
            <div className="helper-text warning">
              This employee has no positions assigned. Please add a position first.
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="certificateType">Certificate Type:</label>
          <select
            id="certificateType"
            name="certificateType"
            value={formData.certificateType}
            onChange={handleInputChange}
            required
          >
            <option value="">-- Select Certificate Type --</option>
            {certificateTypes.map(cert => (
              <option key={cert._id} value={cert._id}>
                {cert.name} ({cert.validityPeriod} months validity)
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="issueDate">Issue Date:</label>
            <input
              type="date"
              id="issueDate"
              name="issueDate"
              value={formData.issueDate}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="expirationDate">Expiration Date:</label>
            <input
              type="date"
              id="expirationDate"
              name="expirationDate"
              value={formData.expirationDate}
              readOnly
              className="readonly-input"
            />
            <div className="helper-text">
              Calculated based on certificate type
            </div>
          </div>
        </div>
        
        <div className="form-actions">
          <button
            type="button"
            className="submit-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Certificate'}
          </button>
          <button
            type="button"
            className="cancel-btn"
            onClick={onCancel || resetForm}
            disabled={loading}
          >
            {onCancel ? 'Cancel' : 'Reset'}
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .certificate-form-container {
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          max-width: 700px;
          margin: 0 auto;
        }
        
        h3 {
          color: #2d3748;
          margin-top: 0;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .form-content {
          background-color: #f8fafc;
          padding: 20px;
          border-radius: 6px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #4a5568;
        }
        
        input,
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.95rem;
        }
        
        .readonly-input {
          background-color: #edf2f7;
          color: #718096;
        }
        
        .helper-text {
          margin-top: 5px;
          font-size: 0.8rem;
          color: #718096;
        }
        
        .helper-text.warning {
          color: #dd6b20;
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
          padding: 12px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .submit-btn:hover:not(:disabled) {
          background-color: #3182ce;
        }
        
        .cancel-btn {
          flex: 1;
          background-color: #e2e8f0;
          color: #4a5568;
          border: none;
          border-radius: 4px;
          padding: 12px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .cancel-btn:hover:not(:disabled) {
          background-color: #cbd5e0;
        }
        
        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .loading-indicator {
          padding: 10px;
          text-align: center;
          color: #4299e1;
          margin-bottom: 15px;
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
        
        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default CertificateForm;