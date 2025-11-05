// src/components/EmployeeRequirements.jsx
import { useState, useEffect } from 'react';

const EmployeeRequirements = ({ employeeId, token }) => {
  const [requirements, setRequirements] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    compliant: 0,
    nonCompliant: 0,
    complianceRate: 0
  });

  // Fetch employee requirements on component mount
  useEffect(() => {
    if (employeeId && token) {
      fetchEmployeeRequirements();
    }
  }, [employeeId, token]);
  
  // Calculate stats when requirements change
  useEffect(() => {
    if (requirements.length > 0) {
      const total = requirements.length;
      const compliant = requirements.filter(req => req.status.isCompliant).length;
      const nonCompliant = total - compliant;
      const complianceRate = Math.round((compliant / total) * 100);
      
      setStats({
        total,
        compliant,
        nonCompliant,
        complianceRate
      });
    }
  }, [requirements]);

  // Fetch requirements for this employee
  const fetchEmployeeRequirements = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Fetching requirements for employee ID:', employeeId); // Debug log
      const response = await fetch(`/api/positionRequirements/employee/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch employee requirements');
      }
      
      const data = await response.json();
      console.log('Employee requirements data:', data); // Debug log
      setEmployee(data.employee);
      setRequirements(data.requirements);
    } catch (err) {
      setError(err.message || 'Error fetching requirements');
    } finally {
      setLoading(false);
    }
  };

  // Helper to format dates
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  // Create status badge based on requirement compliance
  const renderStatusBadge = (requirement) => {
    const { status } = requirement;
    
    if (status.isCompliant) {
      const expiresIn = status.expiresIn;
      
      if (expiresIn <= 30) {
        return <span className="status-badge expiring">Expiring Soon ({expiresIn} days)</span>;
      }
      
      return <span className="status-badge compliant">Compliant</span>;
    }
    
    if (status.certificate) {
      return <span className="status-badge expired">Expired</span>;
    }
    
    return <span className="status-badge missing">Missing</span>;
  };
  
  // Sort requirements with non-compliant first
  const sortedRequirements = [...requirements].sort((a, b) => {
    // Sort by compliance status
    if (a.status.isCompliant && !b.status.isCompliant) return 1;
    if (!a.status.isCompliant && b.status.isCompliant) return -1;
    
    // Then sort by how soon expiring
    if (a.status.isCompliant && b.status.isCompliant) {
      return a.status.expiresIn - b.status.expiresIn;
    }
    
    // Sort by requirement status
    if (a.requirement.isRequired && !b.requirement.isRequired) return -1;
    if (!a.requirement.isRequired && b.requirement.isRequired) return 1;
    
    return 0;
  });

  return (
    <div className="employee-requirements">
      <h3>Certificate Requirements for {employee?.name}</h3>
      
      {loading ? (
        <div className="loading-indicator">Loading requirements...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          {employee && (
            <div className="employee-info">
              <div className="info-item"></div>
              <div className="info-item">
                <strong>Primary Position:</strong> {employee.primaryPosition.title}
              </div>
              <div className="info-item">
                <strong>Department:</strong> {employee.primaryPosition.department || 'N/A'}
              </div>
            </div>
          )}
          
          {requirements.length === 0 ? (
            <div className="no-requirements">
              <p>No certificate requirements defined for this position.</p>
              <p>Go to the Positions tab in Setup to define certificate requirements.</p>
            </div>
          ) : (
            <>
              <div className="compliance-summary">
                <div className="compliance-stat">
                  <span className="stat-label">Compliance Rate:</span>
                  <span className="stat-value">
                    <span 
                      className={`compliance-rate ${stats.complianceRate === 100 
                        ? 'full' 
                        : stats.complianceRate >= 70 
                          ? 'high' 
                          : stats.complianceRate >= 30 
                            ? 'medium' 
                            : 'low'}`}
                    >
                      {stats.complianceRate}%
                    </span>
                  </span>
                </div>
                
                <div className="compliance-stat">
                  <span className="stat-label">Compliant:</span>
                  <span className="stat-value">{stats.compliant} of {stats.total}</span>
                </div>
                
                <div className="compliance-stat">
                  <span className="stat-label">Non-Compliant:</span>
                  <span className="stat-value">{stats.nonCompliant}</span>
                </div>
              </div>
              
              <table className="requirements-table">
                <thead>
                  <tr>
                    <th>Certificate Type</th>
                    <th>Status</th>
                    <th>Issue Date</th>
                    <th>Expiry Date</th>
                    <th>Required</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRequirements.map((req, index) => (
                    <tr 
                      key={req.requirement._id} 
                      className={`${req.status.isCompliant ? 'compliant-row' : 'non-compliant-row'} ${
                        !req.requirement.isRequired ? 'optional-row' : ''
                      }`}
                    >
                      <td>{req.requirement.certificateType}</td>
                      <td>{renderStatusBadge(req)}</td>
                      <td>
                        {req.status.certificate 
                          ? formatDate(req.status.certificate.issueDate) 
                          : '-'
                        }
                      </td>
                      <td>
                        {req.status.certificate 
                          ? formatDate(req.status.certificate.expirationDate) 
                          : '-'
                        }
                      </td>
                      <td>{req.requirement.isRequired ? 'Yes' : 'Optional'}</td>
                      <td>{req.requirement.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
      
      <style jsx>{`
        .employee-requirements {
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
        
        .employee-info {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f7fafc;
          border-radius: 6px;
        }
        
        .info-item {
          color: #4a5568;
        }
        
        .info-item strong {
          margin-right: 5px;
          color: #2d3748;
        }
        
        .no-requirements {
          padding: 20px;
          background-color: #f7fafc;
          border-radius: 6px;
          color: #718096;
          text-align: center;
        }
        
        .compliance-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f7fafc;
          border-radius: 6px;
        }
        
        .compliance-stat {
          display: flex;
          flex-direction: column;
          min-width: 120px;
        }
        
        .stat-label {
          font-size: 0.9rem;
          color: #718096;
          margin-bottom: 5px;
        }
        
        .stat-value {
          font-size: 1.2rem;
          font-weight: 600;
          color: #2d3748;
        }
        
        .compliance-rate {
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .compliance-rate.full {
          background-color: #c6f6d5;
          color: #276749;
        }
        
        .compliance-rate.high {
          background-color: #d6f1dd;
          color: #2b825f;
        }
        
        .compliance-rate.medium {
          background-color: #feebc8;
          color: #9c4221;
        }
        
        .compliance-rate.low {
          background-color: #fed7d7;
          color: #c53030;
        }
        
        .requirements-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.95rem;
        }
        
        .requirements-table th {
          text-align: left;
          padding: 12px 15px;
          background-color: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-bottom: 2px solid #cbd5e0;
        }
        
        .requirements-table td {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
          color: #4a5568;
        }
        
        .compliant-row {
          background-color: #f7fcf9;
        }
        
        .non-compliant-row {
          background-color: #fff5f5;
        }
        
        .optional-row {
          background-color: #f9f8f7;
          font-style: italic;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 500;
        }
        
        .status-badge.compliant {
          background-color: #c6f6d5;
          color: #276749;
        }
        
        .status-badge.expiring {
          background-color: #feebc8;
          color: #9c4221;
        }
        
        .status-badge.expired {
          background-color: #fed7d7;
          color: #c53030;
        }
        
        .status-badge.missing {
          background-color: #e2e8f0;
          color: #4a5568;
        }
        
        .loading-indicator {
          padding: 20px;
          text-align: center;
          color: #4299e1;
        }
        
        .error-message {
          padding: 15px;
          background-color: #fff5f5;
          color: #c53030;
          border-radius: 6px;
        }
        
        @media (max-width: 768px) {
          .requirements-table {
            font-size: 0.85rem;
          }
          
          .requirements-table th,
          .requirements-table td {
            padding: 8px 10px;
          }
          
          .compliance-summary {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeeRequirements;