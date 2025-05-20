import { useState, useEffect } from 'react';

const MultiPositionEmployeeComponent = ({ 
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
          max-width: 800px;
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
        
        @media (max-width: 640px) {
          .positions-container {
            grid-template-columns: 1fr;
          }
          
          .add-position {
            order: -1;
          }
        }
      `}</style>
    </div>
  );
};

export default MultiPositionEmployeeComponent;