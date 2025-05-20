// src/components/PositionRequirements.jsx
import { useState, useEffect } from 'react';

const PositionRequirements = ({ position, token, certificateTypes, onUpdate }) => {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [newRequirement, setNewRequirement] = useState({
    certificateType: '',
    validityPeriod: 12,
    isRequired: true,
    notes: ''
  });
  
  // Fetch position requirements on component mount
  useEffect(() => {
    if (position && token) {
      fetchPositionRequirements();
    }
  }, [position, token]);
  
  // Fetch requirements for this position
  const fetchPositionRequirements = async () => {
    if (!position || !position._id) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/position-requirements/position/${position._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch position requirements');
      }
      
      const data = await response.json();
      setRequirements(data);
    } catch (err) {
      setError(err.message || 'Error fetching requirements');
    } finally {
      setLoading(false);
    }
  };
  
  // Add a new requirement
  const addRequirement = async (e) => {
    e.preventDefault();
    
    if (!newRequirement.certificateType) {
      setError('Please select a certificate type');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/position-requirements', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          position: position._id,
          ...newRequirement
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to add requirement');
      }
      
      // Reset form and refresh requirements
      setSuccess('Requirement added successfully');
      setNewRequirement({
        certificateType: '',
        validityPeriod: 12,
        isRequired: true,
        notes: ''
      });
      await fetchPositionRequirements();
      
      // Notify parent component
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.message || 'Error adding requirement');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete a requirement
  const deleteRequirement = async (requirementId) => {
    if (!confirm('Are you sure you want to remove this requirement?')) {
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/position-requirements/${requirementId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete requirement');
      }
      
      setSuccess('Requirement removed successfully');
      await fetchPositionRequirements();
      
      // Notify parent component
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.message || 'Error removing requirement');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewRequirement(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Check if certificate type is already added
  const isCertificateTypeAdded = (certType) => {
    return requirements.some(req => req.certificateType === certType);
  };
  
  return (
    <div className="position-requirements">
      <h3>Certificate Requirements for {position?.title || 'Position'}</h3>
      
      {loading && <div className="loading-indicator">Loading...</div>}
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="requirements-container">
        {/* Form to add new requirement */}
        <form onSubmit={addRequirement} className="add-requirement-form">
          <h4>Add New Requirement</h4>
          
          <div className="form-group">
            <label>Certificate Type:</label>
            <select 
              name="certificateType"
              value={newRequirement.certificateType}
              onChange={handleInputChange}
              required
            >
              <option value="">-- Select Certificate Type --</option>
              {certificateTypes.map(type => (
                <option 
                  key={type._id} 
                  value={type.name}
                  disabled={isCertificateTypeAdded(type.name)}
                >
                  {type.name} {isCertificateTypeAdded(type.name) ? '(Already Added)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Validity Period (months):</label>
            <input 
              type="number"
              name="validityPeriod"
              value={newRequirement.validityPeriod}
              onChange={handleInputChange}
              min="1"
              required
            />
          </div>
          
          <div className="form-group checkbox-group">
            <input 
              type="checkbox"
              id="isRequired"
              name="isRequired"
              checked={newRequirement.isRequired}
              onChange={handleInputChange}
            />
            <label htmlFor="isRequired">Required Certificate</label>
          </div>
          
          <div className="form-group">
            <label>Notes:</label>
            <textarea 
              name="notes"
              value={newRequirement.notes}
              onChange={handleInputChange}
              placeholder="Optional notes about this requirement"
              rows="2"
            ></textarea>
          </div>
          
          <button 
            type="submit" 
            className="add-button"
            disabled={loading || !newRequirement.certificateType}
          >
            Add Requirement
          </button>
        </form>
        
        {/* List of current requirements */}
        <div className="requirements-list">
          <h4>Current Requirements</h4>
          
          {requirements.length === 0 ? (
            <p className="no-requirements">No certificate requirements defined for this position.</p>
          ) : (
            <table className="requirements-table">
              <thead>
                <tr>
                  <th>Certificate Type</th>
                  <th>Validity Period</th>
                  <th>Required</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map(req => (
                  <tr key={req._id}>
                    <td>{req.certificateType}</td>
                    <td>{req.validityPeriod} months</td>
                    <td>{req.isRequired ? 'Yes' : 'No'}</td>
                    <td>{req.notes || '-'}</td>
                    <td>
                      <button 
                        onClick={() => deleteRequirement(req._id)}
                        className="delete-button"
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .position-requirements {
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
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
        
        .requirements-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        
        @media (min-width: 768px) {
          .requirements-container {
            grid-template-columns: 1fr 2fr;
          }
        }
        
        .add-requirement-form {
          background-color: #f7fafc;
          padding: 15px;
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
        
        .form-group input[type="number"],
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .checkbox-group label {
          margin-bottom: 0;
        }
        
        .checkbox-group input[type="checkbox"] {
          width: 16px;
          height: 16px;
        }
        
        .add-button {
          background-color: #3182ce;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
          width: 100%;
        }
        
        .add-button:hover:not(:disabled) {
          background-color: #2c5282;
        }
        
        .add-button:disabled {
          background-color: #a0aec0;
          cursor: not-allowed;
        }
        
        .requirements-list {
          background-color: #f7fafc;
          padding: 15px;
          border-radius: 6px;
        }
        
        .no-requirements {
          color: #718096;
          font-style: italic;
          padding: 10px 0;
        }
        
        .requirements-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .requirements-table th {
          text-align: left;
          padding: 10px;
          background-color: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-bottom: 2px solid #cbd5e0;
        }
        
        .requirements-table td {
          padding: 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .delete-button {
          background-color: #e53e3e;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 0.8rem;
          cursor: pointer;
        }
        
        .delete-button:hover:not(:disabled) {
          background-color: #c53030;
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
      `}</style>
    </div>
  );
};

export default PositionRequirements;