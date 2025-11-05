import { useState, useEffect } from 'react';

const EmployeeForm = ({ 
  employee = null, 
  positions = [], 
  token, 
  onSubmit, 
  onCancel,
  showArchiveControls = false // New prop to control archive functionality visibility
}) => {
  // Initialize state with existing employee data or defaults
  const [employeeData, setEmployeeData] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    positions: employee?.positions || [],
    primaryPosition: employee?.primaryPosition || '',
    active: employee?.active !== undefined ? employee.active : true
  });
  
  // State for selected positions (for multi-select)
  const [selectedPositions, setSelectedPositions] = useState([]);
  // State for available positions (excluding already selected ones)
  const [availablePositions, setAvailablePositions] = useState([]);
  // State to control requirements visibility
  const [showRequirements, setShowRequirements] = useState(false);
  // State for detailed position data with requirements
  const [detailedPositions, setDetailedPositions] = useState([]);
  // Loading state for requirements
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  // State for employee certificates
  const [employeeCertificates, setEmployeeCertificates] = useState([]);
  
  // Initialize selected positions from employee data
  useEffect(() => {
    if (employee?.positions) {
      setSelectedPositions(employee.positions.map(pos => 
        typeof pos === 'object' ? pos : positions.find(p => p._id === pos)
      ).filter(Boolean));
    }
  }, [employee, positions]);
  
  // Update available positions when selected positions change
  useEffect(() => {
    const selectedIds = selectedPositions.map(pos => pos._id);
    setAvailablePositions(positions.filter(pos => !selectedIds.includes(pos._id)));
  }, [selectedPositions, positions]);
  
  // Add a position to the selected positions
  const addPosition = (positionId) => {
    const positionToAdd = positions.find(pos => pos._id === positionId);
    if (positionToAdd) {
      setSelectedPositions(prev => [...prev, positionToAdd]);
      
      // If no primary position set, make this the primary
      if (!employeeData.primaryPosition) {
        setEmployeeData(prev => ({
          ...prev,
          primaryPosition: positionId
        }));
      }
    }
  };
  
  // Remove a position from the selected positions
  const removePosition = (positionId) => {
    setSelectedPositions(prev => prev.filter(pos => pos._id !== positionId));
    
    // If removing the primary position, set new primary if available
    if (employeeData.primaryPosition === positionId) {
      const remainingPositions = selectedPositions.filter(pos => pos._id !== positionId);
      setEmployeeData(prev => ({
        ...prev,
        primaryPosition: remainingPositions.length > 0 ? remainingPositions[0]._id : ''
      }));
    }
  };
  
  // Set a position as primary
  const setPrimaryPosition = (positionId) => {
    setEmployeeData(prev => ({
      ...prev,
      primaryPosition: positionId
    }));
  };
  
  // Handle input changes for name and email
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEmployeeData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    
    // Prepare data for submission
    const submissionData = {
      ...employeeData,
      positions: selectedPositions.map(pos => pos._id)
    };
    
    onSubmit(submissionData);
  };

  // Archive employee
  const handleArchive = async () => {
    if (!employee || !employee._id) return;
    
    if (!confirm(`Are you sure you want to archive ${employee.name}? They will be excluded from compliance calculations.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/setup/employee/${employee._id}/archive`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to archive employee');
      }
      
      // Update local state
      setEmployeeData(prev => ({ ...prev, active: false }));
      
      // Optionally call onSubmit to refresh parent data
      if (onSubmit) {
        const result = await response.json();
        onSubmit(result.employee);
      }
    } catch (error) {
      console.error('Error archiving employee:', error);
      alert('Failed to archive employee: ' + error.message);
    }
  };

  // Reactivate employee
  const handleReactivate = async () => {
    if (!employee || !employee._id) return;
    
    try {
      const response = await fetch(`/api/setup/employee/${employee._id}/reactivate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reactivate employee');
      }
      
      // Update local state
      setEmployeeData(prev => ({ ...prev, active: true }));
      
      // Optionally call onSubmit to refresh parent data
      if (onSubmit) {
        const result = await response.json();
        onSubmit(result.employee);
      }
    } catch (error) {
      console.error('Error reactivating employee:', error);
      alert('Failed to reactivate employee: ' + error.message);
    }
  };

  // Fetch detailed position data including requirements
  const fetchPositionDetails = async (positionIds) => {
    if (!positionIds.length || !token) return;
    
    setLoadingRequirements(true);
    try {
      // Fetch both requirements and employee certificates
      const [requirementsResponse, certificatesResponse] = await Promise.all([
        fetch('/api/positionRequirements', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        // Fetch all certificates to find ones for this employee
        fetch('/api/certificates', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);
      
      let allRequirements = [];
      let allCertificates = [];
      
      if (requirementsResponse.ok) {
        allRequirements = await requirementsResponse.json();
      }
      
      if (certificatesResponse.ok) {
        allCertificates = await certificatesResponse.json();
        
        // Filter certificates for this employee
        const employeeName = employeeData.name;
        const empCerts = allCertificates.filter(cert => cert.staffMember === employeeName);
        setEmployeeCertificates(empCerts);
      }
      
      // Create detailed positions by combining selected positions with their requirements and certificate status
      const detailedPositionsData = selectedPositions.map(position => {
        // Find requirements for this position
        const positionRequirements = allRequirements.filter(req => 
          req.position && (
            (typeof req.position === 'object' && req.position._id === position._id) ||
            (typeof req.position === 'string' && req.position === position._id)
          )
        );
        
        // Transform requirements to expected format and check certificate status
        const transformedRequirements = positionRequirements.map(req => {
          // Find matching certificates for this requirement
          const employeeName = employeeData.name;
          const matchingCerts = allCertificates.filter(cert => 
            cert.staffMember === employeeName && 
            (cert.certType === req.certificateType || cert.certificateType === req.certificateType || cert.certificateName === req.certificateType)
          );
          
          // Find the most recent valid certificate
          let isCompliant = false;
          let certificateInfo = null;
          
          if (matchingCerts.length > 0) {
            // Sort by expiration date descending to get the most recent
            matchingCerts.sort((a, b) => new Date(b.expirationDate) - new Date(a.expirationDate));
            const latestCert = matchingCerts[0];
            
            // Check if certificate is still valid
            const expirationDate = new Date(latestCert.expirationDate);
            const now = new Date();
            isCompliant = expirationDate > now;
            
            certificateInfo = {
              issueDate: latestCert.issueDate,
              expirationDate: latestCert.expirationDate,
              status: latestCert.status || (isCompliant ? 'ACTIVE' : 'EXPIRED')
            };
          }
          
          return {
            _id: req._id,
            name: req.certificateType,
            title: req.certificateType,
            description: req.notes || `${req.certificateType} certification required`,
            type: 'certification',
            validityPeriod: req.validityPeriod,
            isRequired: req.isRequired,
            // Add compliance status
            isCompliant,
            certificateInfo,
            status: isCompliant ? 'Compliant' : 'Missing'
          };
        });
        
        return {
          ...position,
          requirements: transformedRequirements
        };
      });
      
      setDetailedPositions(detailedPositionsData);
      
    } catch (error) {
      console.error('Error fetching position details:', error);
      const fallbackPositions = selectedPositions.map(position => ({
        ...position,
        requirements: []
      }));
      setDetailedPositions(fallbackPositions);
    } finally {
      setLoadingRequirements(false);
    }
  };

  // Handle show requirements toggle
  const handleShowRequirements = async () => {
    if (!showRequirements && selectedPositions.length > 0) {
      // Fetch detailed position data when showing requirements
      const positionIds = selectedPositions.map(pos => pos._id);
      await fetchPositionDetails(positionIds);
    }
    setShowRequirements(!showRequirements);
  };

  // Update detailed positions when selected positions change
  useEffect(() => {
    if (showRequirements && selectedPositions.length > 0) {
      const positionIds = selectedPositions.map(pos => pos._id);
      fetchPositionDetails(positionIds);
    } else if (selectedPositions.length === 0) {
      setDetailedPositions([]);
    }
  }, [selectedPositions, showRequirements]);

  // Get all unique requirements across all selected positions
  const getAllRequirements = () => {
    const allRequirements = new Map();
    
    detailedPositions.forEach(position => {
      if (position.requirements && Array.isArray(position.requirements)) {
        position.requirements.forEach(req => {
          const key = typeof req === 'object' ? (req._id || req.name || req.title) : req;
          if (key) {
            allRequirements.set(key, {
              requirement: typeof req === 'object' ? req : { name: req },
              positions: allRequirements.has(key) 
                ? [...allRequirements.get(key).positions, position.title]
                : [position.title]
            });
          }
        });
      }
    });
    
    return Array.from(allRequirements.values());
  };
  
  return (
    <div className="employee-form">
      <div className="form-content">
        {/* Employee Status Indicator */}
        {employee && (
          <div className={`employee-status-indicator ${employeeData.active ? 'active' : 'inactive'}`}>
            <div className="status-info">
              <span className="status-label">Status:</span>
              <span className={`status-value ${employeeData.active ? 'active' : 'inactive'}`}>
                {employeeData.active ? 'Active' : 'Archived'}
              </span>
              {!employeeData.active && (
                <span className="status-note">
                  (Excluded from compliance calculations)
                </span>
              )}
            </div>
            
            {showArchiveControls && (
              <div className="status-actions">
                {employeeData.active ? (
                  <button
                    type="button"
                    className="archive-btn"
                    onClick={handleArchive}
                  >
                    Archive Employee
                  </button>
                ) : (
                  <button
                    type="button"
                    className="reactivate-btn"
                    onClick={handleReactivate}
                  >
                    Reactivate Employee
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="name">Employee Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={employeeData.name}
            onChange={handleInputChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={employeeData.email}
            onChange={handleInputChange}
            required
          />
        </div>
        
        {/* Active Status Checkbox for New Employees or Manual Override */}
        {(!employee || showArchiveControls) && (
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                checked={employeeData.active}
                onChange={handleInputChange}
              />
              Employee is active (included in compliance calculations)
            </label>
          </div>
        )}
        
        <div className="form-group">
          <label>Positions:</label>
          <div className="positions-container">
            <div className="selected-positions">
              <h4>Assigned Positions</h4>
              {selectedPositions.length === 0 ? (
                <p className="no-positions">No positions assigned</p>
              ) : (
                <div className="table-container">
                  <table className="positions-table">
                    <thead>
                      <tr>
                        <th>Position</th>
                        <th>Department</th>
                        <th>Primary</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPositions.map(position => (
                        <tr key={position._id}>
                          <td>{position.title}</td>
                          <td>{position.department || 'N/A'}</td>
                          <td>
                            <input
                              type="radio"
                              name="primaryPosition"
                              checked={employeeData.primaryPosition === position._id}
                              onChange={() => setPrimaryPosition(position._id)}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="remove-btn"
                              onClick={() => removePosition(position._id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="add-position">
              <h4>Add Position</h4>
              <select
                value=""
                onChange={(e) => addPosition(e.target.value)}
                disabled={availablePositions.length === 0}
              >
                <option value="">-- Select Position --</option>
                {availablePositions.map(position => (
                  <option key={position._id} value={position._id}>
                    {position.title} ({position.department || 'No Department'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Position Requirements Section */}
        {selectedPositions.length > 0 && (
          <div className="form-group">
            <div className="requirements-header">
              <label>Position Requirements:</label>
              <button
                type="button"
                className="toggle-requirements-btn"
                onClick={handleShowRequirements}
                disabled={loadingRequirements}
              >
                {loadingRequirements ? 'Loading...' : showRequirements ? 'Hide Requirements' : 'Show Requirements'}
              </button>
            </div>
            
            {showRequirements && (
              <div className="requirements-container">
                {loadingRequirements ? (
                  <div className="loading-message">
                    <p>Loading position requirements...</p>
                  </div>
                ) : detailedPositions.length === 0 ? (
                  <div className="no-data-message">
                    <p>No position requirements found.</p>
                  </div>
                ) : (
                  <>
                    <div className="requirements-summary">
                      <h4>All Requirements Summary</h4>
                      {getAllRequirements().length === 0 ? (
                        <p className="no-requirements">No requirements found across all positions.</p>
                      ) : (
                        <div className="requirements-grid">
                          {getAllRequirements().map((item, index) => (
                            <div key={index} className={`requirement-card ${item.requirement.isCompliant ? 'compliant' : 'non-compliant'}`}>
                              <div className="requirement-name">
                                {item.requirement.name || item.requirement.title || 'Requirement'}
                                <span className={`compliance-badge ${item.requirement.isCompliant ? 'compliant' : 'missing'}`}>
                                  {item.requirement.status}
                                </span>
                              </div>
                              {item.requirement.certificateInfo && (
                                <div className="certificate-info">
                                  <div><strong>Issue:</strong> {new Date(item.requirement.certificateInfo.issueDate).toLocaleDateString()}</div>
                                  <div><strong>Expires:</strong> {new Date(item.requirement.certificateInfo.expirationDate).toLocaleDateString()}</div>
                                  <div><strong>Status:</strong> {item.requirement.certificateInfo.status}</div>
                                </div>
                              )}
                              <div className="requirement-positions">
                                <strong>Required for:</strong> {item.positions.join(', ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="form-actions">
          <button type="button" className="submit-btn" onClick={handleSubmit}>
            {employee ? 'Update Employee' : 'Add Employee'}
          </button>
          <button type="button" className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
      
      <style jsx>{`
        .employee-form {
          background-color: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          max-width: 1000px;
          margin: 0 auto;
        }
        
        .employee-status-indicator {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
          border: 1px solid;
        }
        
        .employee-status-indicator.active {
          background-color: #f0fff4;
          border-color: #9ae6b4;
        }
        
        .employee-status-indicator.inactive {
          background-color: #fff5f5;
          border-color: #fed7d7;
        }
        
        .status-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .status-label {
          font-weight: 600;
          color: #4a5568;
        }
        
        .status-value {
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .status-value.active {
          background-color: #c6f6d5;
          color: #276749;
        }
        
        .status-value.inactive {
          background-color: #fed7d7;
          color: #c53030;
        }
        
        .status-note {
          font-size: 0.9rem;
          color: #718096;
          font-style: italic;
        }
        
        .status-actions {
          display: flex;
          gap: 10px;
        }
        
        .archive-btn {
          background-color: #f56565;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .archive-btn:hover {
          background-color: #e53e3e;
        }
        
        .reactivate-btn {
          background-color: #48bb78;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 12px;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .reactivate-btn:hover {
          background-color: #38a169;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #4a5568;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
        }
        
        input[type="text"],
        input[type="email"],
        select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.95rem;
        }
        
        .positions-container {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          margin-top: 10px;
        }
        
        .selected-positions, .add-position {
          background-color: white;
          padding: 15px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        
        h4 {
          margin-top: 0;
          margin-bottom: 15px;
          color: #2d3748;
          font-size: 1rem;
        }

        h5 {
          margin: 0;
          color: #2d3748;
          font-size: 0.95rem;
        }
        
        .no-positions {
          color: #a0aec0;
          font-style: italic;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        .positions-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .positions-table th {
          text-align: left;
          padding: 8px;
          border-bottom: 2px solid #e2e8f0;
          color: #4a5568;
          font-weight: 600;
        }
        
        .positions-table td {
          padding: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .remove-btn {
          background-color: #f56565;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 0.85rem;
          cursor: pointer;
        }
        
        .remove-btn:hover {
          background-color: #e53e3e;
        }

        /* Requirements Section Styles */
        .requirements-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .toggle-requirements-btn {
          background-color: #805ad5;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 0.85rem;
          cursor: pointer;
        }

        .toggle-requirements-btn:hover {
          background-color: #6b46c1;
        }

        .toggle-requirements-btn:disabled {
          background-color: #a0aec0;
          cursor: not-allowed;
        }

        .loading-message, .no-data-message {
          text-align: center;
          padding: 20px;
          color: #4a5568;
        }

        .requirements-container {
          background-color: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 20px;
          margin-top: 10px;
        }

        .requirements-summary {
          margin-bottom: 30px;
        }

        .requirements-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .requirement-card {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 15px;
          background-color: #f7fafc;
        }

        .requirement-card.compliant {
          border-color: #10b981;
          background-color: #f0fdf4;
        }

        .requirement-card.non-compliant {
          border-color: #ef4444;
          background-color: #fef2f2;
        }

        .compliance-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          margin-left: 8px;
        }

        .compliance-badge.compliant {
          background-color: #d1fae5;
          color: #10b981;
        }

        .compliance-badge.missing {
          background-color: #fee2e2;
          color: #ef4444;
        }

        .certificate-info {
          background-color: #e0f2fe;
          padding: 8px;
          border-radius: 4px;
          margin: 8px 0;
          font-size: 0.85rem;
        }

        .certificate-info div {
          margin-bottom: 4px;
        }

        .certificate-info div:last-child {
          margin-bottom: 0;
        }

        .requirement-name {
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .requirement-positions {
          color: #2b6cb0;
          font-size: 0.85rem;
          margin-top: 8px;
        }

        .no-requirements {
          color: #a0aec0;
          font-style: italic;
        }
        
        .form-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        .submit-btn {
          background-color: #4299e1;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .submit-btn:hover {
          background-color: #3182ce;
        }
        
        .cancel-btn {
          background-color: #e2e8f0;
          color: #4a5568;
          border: none;
          border-radius: 4px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .cancel-btn:hover {
          background-color: #cbd5e0;
        }
        
        @media (max-width: 768px) {
          .employee-status-indicator {
            flex-direction: column;
            gap: 15px;
            align-items: flex-start;
          }
          
          .status-info {
            flex-wrap: wrap;
          }
          
          .positions-container {
            grid-template-columns: 1fr;
          }
          
          .add-position {
            order: -1;
          }

          .requirements-grid {
            grid-template-columns: 1fr;
          }

          .requirements-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeeForm;

