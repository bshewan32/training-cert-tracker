import { useState, useEffect } from 'react';

const EmployeeForm = ({ 
  employee = null, 
  positions = [], 
  token, 
  onSubmit, 
  onCancel 
}) => {
  // Initialize state with existing employee data or defaults
  const [employeeData, setEmployeeData] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    positions: employee?.positions || [],
    primaryPosition: employee?.primaryPosition || ''
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
    const { name, value } = e.target;
    setEmployeeData(prev => ({
      ...prev,
      [name]: value
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

  // Fetch detailed position data including requirements
  const fetchPositionDetails = async (positionIds) => {
    if (!positionIds.length || !token) return;
    
    setLoadingRequirements(true);
    try {
      // Use the correct base URL that matches your app
      const response = await fetch('https://training-cert-tracker.onrender.com/api/positionRequirements', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const allRequirements = await response.json();
        console.log('All requirements fetched:', allRequirements);
        
        // Create detailed positions by combining selected positions with their requirements
        const detailedPositionsData = selectedPositions.map(position => {
          // Find requirements for this position
          const positionRequirements = allRequirements.filter(req => 
            req.position && (
              (typeof req.position === 'object' && req.position._id === position._id) ||
              (typeof req.position === 'string' && req.position === position._id)
            )
          );
          
          console.log(`Requirements for position ${position.title}:`, positionRequirements);
          
          // Transform requirements to expected format
          const transformedRequirements = positionRequirements.map(req => ({
            _id: req._id,
            name: req.certificateType,
            title: req.certificateType,
            description: req.notes || `${req.certificateType} certification required`,
            type: 'certification',
            validityPeriod: req.validityPeriod,
            isRequired: req.isRequired
          }));
          
          return {
            ...position,
            requirements: transformedRequirements
          };
        });
        
        console.log('Detailed positions created:', detailedPositionsData);
        setDetailedPositions(detailedPositionsData);
      } else {
        console.error('Failed to fetch requirements:', response.status, response.statusText);
        // Fallback: create detailed positions without requirements
        const fallbackPositions = selectedPositions.map(position => ({
          ...position,
          requirements: []
        }));
        setDetailedPositions(fallbackPositions);
      }
    } catch (error) {
      console.error('Error fetching position details:', error);
      // Fallback: create detailed positions without requirements
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
                    <p>This could mean:</p>
                    <ul>
                      <li>The selected positions don't have any requirements configured</li>
                      <li>The requirements data is still loading</li>
                      <li>There may be an issue with the API connection</li>
                    </ul>
                    <p><small>Check the browser console for detailed error messages.</small></p>
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
                            <div key={index} className="requirement-card">
                              <div className="requirement-name">
                                {item.requirement.name || item.requirement.title || 'Requirement'}
                              </div>
                              {item.requirement.description && (
                                <div className="requirement-description">
                                  {item.requirement.description}
                                </div>
                              )}
                              {item.requirement.validityPeriod && (
                                <div className="requirement-validity">
                                  <strong>Validity:</strong> {item.requirement.validityPeriod} months
                                </div>
                              )}
                              <div className="requirement-positions">
                                <strong>Required for:</strong> {item.positions.join(', ')}
                              </div>
                              {item.requirement.isRequired !== undefined && (
                                <div className="requirement-mandatory">
                                  <span className={`mandatory-badge ${item.requirement.isRequired ? 'required' : 'optional'}`}>
                                    {item.requirement.isRequired ? 'Required' : 'Optional'}
                                  </span>
                                </div>
                              )}
                              {item.requirement.type && (
                                <div className="requirement-type">
                                  <span className={`type-badge ${item.requirement.type.toLowerCase()}`}>
                                    {item.requirement.type}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="requirements-by-position">
                      <h4>Requirements by Position</h4>
                      {detailedPositions.map(position => (
                        <div key={position._id} className="position-requirements">
                          <div className="position-header">
                            <h5>{position.title}</h5>
                            {employeeData.primaryPosition === position._id && (
                              <span className="primary-badge">Primary</span>
                            )}
                          </div>
                          
                          {position.requirements && position.requirements.length > 0 ? (
                            <ul className="requirements-list">
                              {position.requirements.map((req, reqIndex) => (
                                <li key={reqIndex} className="requirement-item">
                                  <span className="req-name">
                                    {typeof req === 'object' ? (req.name || req.title) : req}
                                  </span>
                                  {typeof req === 'object' && req.description && (
                                    <span className="req-description"> - {req.description}</span>
                                  )}
                                  {typeof req === 'object' && req.validityPeriod && (
                                    <span className="req-validity"> (Valid for {req.validityPeriod} months)</span>
                                  )}
                                  {typeof req === 'object' && req.isRequired !== undefined && (
                                    <span className={`req-mandatory-badge ${req.isRequired ? 'required' : 'optional'}`}>
                                      {req.isRequired ? 'Required' : 'Optional'}
                                    </span>
                                  )}
                                  {typeof req === 'object' && req.type && (
                                    <span className={`req-type-badge ${req.type.toLowerCase()}`}>
                                      {req.type}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="no-requirements">No specific requirements listed</p>
                          )}
                        </div>
                      ))}
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
        
        .form-group {
          margin-bottom: 20px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #4a5568;
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

        .no-data-message ul {
          text-align: left;
          display: inline-block;
          margin-top: 10px;
        }

        .no-data-message li {
          margin-bottom: 5px;
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

        .requirement-name {
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .requirement-description {
          color: #4a5568;
          font-size: 0.9rem;
          margin-bottom: 8px;
        }

        .requirement-positions {
          color: #2b6cb0;
          font-size: 0.85rem;
          margin-bottom: 8px;
        }

        .requirement-validity {
          color: #805ad5;
          font-size: 0.85rem;
          margin-bottom: 8px;
        }

        .requirement-mandatory {
          margin-bottom: 8px;
        }

        .mandatory-badge, .req-mandatory-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .mandatory-badge.required, .req-mandatory-badge.required {
          background-color: #fed7d7;
          color: #c53030;
        }

        .mandatory-badge.optional, .req-mandatory-badge.optional {
          background-color: #e6fffa;
          color: #319795;
        }

        .req-validity {
          color: #805ad5;
          font-size: 0.85rem;
          font-style: italic;
        }

        .requirement-type {
          margin-top: 8px;
        }

        .type-badge, .req-type-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .type-badge.certification, .req-type-badge.certification {
          background-color: #fed7d7;
          color: #c53030;
        }

        .type-badge.skill, .req-type-badge.skill {
          background-color: #bee3f8;
          color: #2b6cb0;
        }

        .type-badge.education, .req-type-badge.education {
          background-color: #c6f6d5;
          color: #2f855a;
        }

        .type-badge.experience, .req-type-badge.experience {
          background-color: #fbb6ce;
          color: #b83280;
        }

        .requirements-by-position {
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
        }

        .position-requirements {
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f7fafc;
          border-radius: 6px;
        }

        .position-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .primary-badge {
          background-color: #4299e1;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .requirements-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .requirement-item {
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .requirement-item:last-child {
          border-bottom: none;
        }

        .req-name {
          font-weight: 500;
          color: #2d3748;
        }

        .req-description {
          color: #4a5568;
          font-size: 0.9rem;
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

// import { useState, useEffect } from 'react';

// const EmployeeForm = ({ 
//   employee = null, 
//   positions = [], 
//   token, 
//   onSubmit, 
//   onCancel 
// }) => {
//   // Initialize state with existing employee data or defaults
//   const [employeeData, setEmployeeData] = useState({
//     name: employee?.name || '',
//     email: employee?.email || '',
//     positions: employee?.positions || [],
//     primaryPosition: employee?.primaryPosition || ''
//   });
  
//   // State for selected positions (for multi-select)
//   const [selectedPositions, setSelectedPositions] = useState([]);
//   // State for available positions (excluding already selected ones)
//   const [availablePositions, setAvailablePositions] = useState([]);
  
//   // Initialize selected positions from employee data
//   useEffect(() => {
//     if (employee?.positions) {
//       setSelectedPositions(employee.positions.map(pos => 
//         typeof pos === 'object' ? pos : positions.find(p => p._id === pos)
//       ).filter(Boolean));
//     }
//   }, [employee, positions]);
  
//   // Update available positions when selected positions change
//   useEffect(() => {
//     const selectedIds = selectedPositions.map(pos => pos._id);
//     setAvailablePositions(positions.filter(pos => !selectedIds.includes(pos._id)));
//   }, [selectedPositions, positions]);
  
//   // Add a position to the selected positions
//   const addPosition = (positionId) => {
//     const positionToAdd = positions.find(pos => pos._id === positionId);
//     if (positionToAdd) {
//       setSelectedPositions(prev => [...prev, positionToAdd]);
      
//       // If no primary position set, make this the primary
//       if (!employeeData.primaryPosition) {
//         setEmployeeData(prev => ({
//           ...prev,
//           primaryPosition: positionId
//         }));
//       }
//     }
//   };
  
//   // Remove a position from the selected positions
//   const removePosition = (positionId) => {
//     setSelectedPositions(prev => prev.filter(pos => pos._id !== positionId));
    
//     // If removing the primary position, set new primary if available
//     if (employeeData.primaryPosition === positionId) {
//       const remainingPositions = selectedPositions.filter(pos => pos._id !== positionId);
//       setEmployeeData(prev => ({
//         ...prev,
//         primaryPosition: remainingPositions.length > 0 ? remainingPositions[0]._id : ''
//       }));
//     }
//   };
  
//   // Set a position as primary
//   const setPrimaryPosition = (positionId) => {
//     setEmployeeData(prev => ({
//       ...prev,
//       primaryPosition: positionId
//     }));
//   };
  
//   // Handle input changes for name and email
//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setEmployeeData(prev => ({
//       ...prev,
//       [name]: value
//     }));
//   };
  
//   // Handle form submission
//   const handleSubmit = (e) => {
//     if (e) e.preventDefault();
    
//     // Prepare data for submission
//     const submissionData = {
//       ...employeeData,
//       positions: selectedPositions.map(pos => pos._id)
//     };
    
//     onSubmit(submissionData);
//   };
  
//   return (
//     <div className="employee-form">
//       <div className="form-content">
//         <div className="form-group">
//           <label htmlFor="name">Employee Name:</label>
//           <input
//             type="text"
//             id="name"
//             name="name"
//             value={employeeData.name}
//             onChange={handleInputChange}
//             required
//           />
//         </div>
        
//         <div className="form-group">
//           <label htmlFor="email">Email:</label>
//           <input
//             type="email"
//             id="email"
//             name="email"
//             value={employeeData.email}
//             onChange={handleInputChange}
//             required
//           />
//         </div>
        
//         <div className="form-group">
//           <label>Positions:</label>
//           <div className="positions-container">
//             <div className="selected-positions">
//               <h4>Assigned Positions</h4>
//               {selectedPositions.length === 0 ? (
//                 <p className="no-positions">No positions assigned</p>
//               ) : (
//                 <div className="table-container">
//                   <table className="positions-table">
//                     <thead>
//                       <tr>
//                         <th>Position</th>
//                         <th>Department</th>
//                         <th>Primary</th>
//                         <th>Actions</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {selectedPositions.map(position => (
//                         <tr key={position._id}>
//                           <td>{position.title}</td>
//                           <td>{position.department || 'N/A'}</td>
//                           <td>
//                             <input
//                               type="radio"
//                               name="primaryPosition"
//                               checked={employeeData.primaryPosition === position._id}
//                               onChange={() => setPrimaryPosition(position._id)}
//                             />
//                           </td>
//                           <td>
//                             <button
//                               type="button"
//                               className="remove-btn"
//                               onClick={() => removePosition(position._id)}
//                             >
//                               Remove
//                             </button>
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               )}
//             </div>
            
//             <div className="add-position">
//               <h4>Add Position</h4>
//               <select
//                 value=""
//                 onChange={(e) => addPosition(e.target.value)}
//                 disabled={availablePositions.length === 0}
//               >
//                 <option value="">-- Select Position --</option>
//                 {availablePositions.map(position => (
//                   <option key={position._id} value={position._id}>
//                     {position.title} ({position.department || 'No Department'})
//                   </option>
//                 ))}
//               </select>
//             </div>
//           </div>
//         </div>
        
//         <div className="form-actions">
//           <button type="button" className="submit-btn" onClick={handleSubmit}>
//             {employee ? 'Update Employee' : 'Add Employee'}
//           </button>
//           <button type="button" className="cancel-btn" onClick={onCancel}>
//             Cancel
//           </button>
//         </div>
//       </div>
      
//       <style jsx>{`
//         .employee-form {
//           background-color: #f8fafc;
//           padding: 20px;
//           border-radius: 8px;
//           max-width: 800px;
//           margin: 0 auto;
//         }
        
//         .form-group {
//           margin-bottom: 20px;
//         }
        
//         label {
//           display: block;
//           margin-bottom: 5px;
//           font-weight: 500;
//           color: #4a5568;
//         }
        
//         input[type="text"],
//         input[type="email"],
//         select {
//           width: 100%;
//           padding: 8px 12px;
//           border: 1px solid #cbd5e0;
//           border-radius: 4px;
//           font-size: 0.95rem;
//         }
        
//         .positions-container {
//           display: grid;
//           grid-template-columns: 2fr 1fr;
//           gap: 20px;
//           margin-top: 10px;
//         }
        
//         .selected-positions, .add-position {
//           background-color: white;
//           padding: 15px;
//           border-radius: 6px;
//           border: 1px solid #e2e8f0;
//         }
        
//         h4 {
//           margin-top: 0;
//           margin-bottom: 15px;
//           color: #2d3748;
//           font-size: 1rem;
//         }
        
//         .no-positions {
//           color: #a0aec0;
//           font-style: italic;
//         }
        
//         .table-container {
//           overflow-x: auto;
//         }
        
//         .positions-table {
//           width: 100%;
//           border-collapse: collapse;
//         }
        
//         .positions-table th {
//           text-align: left;
//           padding: 8px;
//           border-bottom: 2px solid #e2e8f0;
//           color: #4a5568;
//           font-weight: 600;
//         }
        
//         .positions-table td {
//           padding: 8px;
//           border-bottom: 1px solid #e2e8f0;
//         }
        
//         .remove-btn {
//           background-color: #f56565;
//           color: white;
//           border: none;
//           border-radius: 4px;
//           padding: 4px 8px;
//           font-size: 0.85rem;
//           cursor: pointer;
//         }
        
//         .remove-btn:hover {
//           background-color: #e53e3e;
//         }
        
//         .form-actions {
//           display: flex;
//           gap: 10px;
//           margin-top: 20px;
//         }
        
//         .submit-btn {
//           background-color: #4299e1;
//           color: white;
//           border: none;
//           border-radius: 4px;
//           padding: 10px 16px;
//           font-weight: 500;
//           cursor: pointer;
//         }
        
//         .submit-btn:hover {
//           background-color: #3182ce;
//         }
        
//         .cancel-btn {
//           background-color: #e2e8f0;
//           color: #4a5568;
//           border: none;
//           border-radius: 4px;
//           padding: 10px 16px;
//           font-weight: 500;
//           cursor: pointer;
//         }
        
//         .cancel-btn:hover {
//           background-color: #cbd5e0;
//         }
        
//         @media (max-width: 640px) {
//           .positions-container {
//             grid-template-columns: 1fr;
//           }
          
//           .add-position {
//             order: -1;
//           }
//         }
//       `}</style>
//     </div>
//   );
// };

// export default EmployeeForm;