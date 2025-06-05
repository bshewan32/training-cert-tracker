import {
  useState,
  useEffect
} from 'react';

const CertificatesWithDashboard = ({
  token,
  employees = [],
  positions = [],
  certificateTypes = [],
  certificates = [],
  isAdmin = false,
  onViewEmployee,
  onViewAdmin,
  onCertificateAdded,
  onCertificateDeleted
}) => {
  const [dashboardStats, setDashboardStats] = useState({
    totalCertificates: 0,
    activeCertificates: 0,
    expiringSoon: 0,
    expired: 0,
    totalEmployees: 0,
    complianceRate: 0
  });
  const [complianceByPosition, setComplianceByPosition] = useState([]);
  const [urgentActions, setUrgentActions] = useState([]);
  const [positionRequirements, setPositionRequirements] = useState([]);
  const [selectedFilterEmployee, setSelectedFilterEmployee] = useState('');
  const [selectedFilterCertType, setSelectedFilterCertType] = useState('');
  const [selectedFilterPosition, setSelectedFilterPosition] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedCertificateType, setSelectedCertificateType] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    calculateDashboardStats();
  }, [certificates, employees, positions, positionRequirements]);

  // Fetch position requirements when component mounts
  useEffect(() => {
    fetchPositionRequirements();
  }, [token]);

  // Auto-calculate expiry date when certificate type or issue date changes
  useEffect(() => {
    if (selectedCertificateType && issueDate) {
      const certType = certificateTypes.find(cert => cert._id === selectedCertificateType);
      if (certType && certType.validityPeriod) {
        const issue = new Date(issueDate);
        const expiry = new Date(issue);
        expiry.setMonth(expiry.getMonth() + certType.validityPeriod);
        setExpiryDate(expiry.toISOString().split('T')[0]);
      }
    }
  }, [selectedCertificateType, issueDate, certificateTypes]);

  const fetchPositionRequirements = async () => {
    if (!token) return;
    
    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/positionRequirements', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const requirements = await response.json();
        console.log('Position requirements fetched:', requirements);
        setPositionRequirements(requirements || []);
      } else {
        console.warn('Failed to fetch position requirements:', response.status);
        setPositionRequirements([]);
      }
    } catch (error) {
      console.error('Error fetching position requirements:', error);
      setPositionRequirements([]);
    }
  };

  const calculateDashboardStats = () => {
    console.log('Starting dashboard calculation with:', {
      certificatesCount: certificates.length,
      employeesCount: employees.length,
      positionsCount: positions.length,
      requirementsCount: positionRequirements.length
    });

    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const totalCertificates = certificates.length;
    const activeCertificates = certificates.filter(cert => 
      cert.status === 'ACTIVE' || cert.status === 'Active'
    ).length;
    const expiringSoon = certificates.filter(cert => {
      const expiryDate = new Date(cert.expirationDate);
      const isActive = cert.status === 'ACTIVE' || cert.status === 'Active';
      return isActive && expiryDate > today && expiryDate <= thirtyDaysFromNow;
    }).length;
    const expired = certificates.filter(cert => 
      cert.status === 'EXPIRED' || cert.status === 'Expired'
    ).length;

    const activeEmployees = employees.filter(emp => emp.active !== false);
    const totalEmployees = activeEmployees.length;

    let requiredCertCount = 0;
    let activeRequiredCertCount = 0;

    console.log('Active employees:', activeEmployees.length);
    console.log('Position requirements:', positionRequirements);

    activeEmployees.forEach(emp => {
      if (emp.positions && Array.isArray(emp.positions)) {
        emp.positions.forEach(posId => {
          if (posId) { // Check if posId exists
            const positionId = typeof posId === 'object' ? posId._id : posId;
            if (positionId) { // Check if positionId exists
              const position = positions.find(p => p._id === positionId);
              
              if (position) {
                // Find requirements for this position
                const requirements = positionRequirements.filter(req => {
                  if (!req || !req.position) return false;
                  const reqPositionId = typeof req.position === 'object' ? req.position._id : req.position;
                  return reqPositionId === positionId && req.isRequired && req.active;
                });
                
                console.log(`Employee ${emp.name}, Position ${position.title}, Requirements:`, requirements.length);
                
                requirements.forEach(requirement => {
                  requiredCertCount++;
                  const hasActive = certificates.some(cert => {
                    const isActive = cert.status === 'ACTIVE' || cert.status === 'Active';
                    const certTypeMatch = cert.certType === requirement.certificateType || 
                                         cert.CertType === requirement.certificateType || 
                                         cert.certificateName === requirement.certificateType || 
                                         cert.certificateType === requirement.certificateType;
                    return cert.staffMember === emp.name && certTypeMatch && isActive;
                  });
                  if (hasActive) activeRequiredCertCount++;
                });
              }
            }
          }
        });
      }
    });

    console.log('Compliance calculation:', {
      requiredCertCount,
      activeRequiredCertCount,
      complianceRate: requiredCertCount > 0 ? Math.round((activeRequiredCertCount / requiredCertCount) * 100) : 0
    });

    const complianceRate = requiredCertCount > 0
      ? Math.round((activeRequiredCertCount / requiredCertCount) * 100)
      : 0;

    setDashboardStats({
      totalCertificates,
      activeCertificates,
      expiringSoon,
      expired,
      totalEmployees,
      complianceRate
    });

    const positionStats = [];
    positions.forEach(position => {
      const positionCerts = certificates.filter(cert => cert.position === position._id);
      const activeCerts = positionCerts.filter(cert => 
        cert.status === 'ACTIVE' || cert.status === 'Active'
      );
      const employeesInPosition = activeEmployees.filter(emp =>
        emp.positions && Array.isArray(emp.positions) && emp.positions.some(pos => {
          if (!pos) return false;
          const empPosId = typeof pos === 'object' ? pos._id : pos;
          return empPosId === position._id;
        })
      );
      
      // Get requirements for this position
      const requirements = positionRequirements.filter(req => {
        if (!req || !req.position) return false;
        const reqPositionId = typeof req.position === 'object' ? req.position._id : req.position;
        return reqPositionId === position._id && req.isRequired && req.active;
      });
      
      if (employeesInPosition.length > 0 && requirements.length > 0) {
        // Calculate compliance based on required certificates vs actual certificates
        let totalRequiredCerts = employeesInPosition.length * requirements.length;
        let completedRequiredCerts = 0;
        
        employeesInPosition.forEach(emp => {
          requirements.forEach(requirement => {
            const hasValidCert = certificates.some(cert => {
              const isActive = cert.status === 'ACTIVE' || cert.status === 'Active';
              const certTypeMatch = cert.certType === requirement.certificateType || 
                                   cert.CertType === requirement.certificateType || 
                                   cert.certificateName === requirement.certificateType || 
                                   cert.certificateType === requirement.certificateType;
              return cert.staffMember === emp.name && certTypeMatch && isActive;
            });
            if (hasValidCert) completedRequiredCerts++;
          });
        });
        
        const complianceRate = totalRequiredCerts > 0
          ? Math.round((completedRequiredCerts / totalRequiredCerts) * 100)
          : 0;
        
        positionStats.push({
          position: position.title,
          department: position.department || 'No Department',
          employees: employeesInPosition.length,
          totalCerts: positionCerts.length,
          activeCerts: activeCerts.length,
          requiredCerts: requirements.length,
          totalRequiredCerts,
          completedRequiredCerts,
          complianceRate
        });
      }
    });
    positionStats.sort((a, b) => a.complianceRate - b.complianceRate);
    setComplianceByPosition(positionStats.slice(0, 5));

    const urgent = certificates
      .filter(cert => {
        const expiryDate = new Date(cert.expirationDate);
        const isActive = cert.status === 'ACTIVE' || cert.status === 'Active';
        return isActive && expiryDate > today && expiryDate <= thirtyDaysFromNow;
      })
      .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
      .slice(0, 5)
      .map(cert => ({
        employee: cert.staffMember,
        certificate: cert.certType || cert.CertType || cert.certificateName || cert.certificateType,
        expiryDate: cert.expirationDate,
        daysLeft: Math.ceil((new Date(cert.expirationDate) - today) / (1000 * 60 * 60 * 24))
      }));

    setUrgentActions(urgent);
  };

  const handleCertificateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!selectedEmployee || !selectedPosition || !issueDate || !expiryDate) {
      setError('Please fill in all fields');
      return;
    }

    const employee = employees.find(emp => emp._id === selectedEmployee);
    if (!employee) {
      setError('Please select a valid employee');
      return;
    }

    const position = positions.find(pos => pos._id === selectedPosition);
    if (!position) {
      setError('Please select a valid position');
      return;
    }

    const certType = certificateTypes.find(cert => cert._id === selectedCertificateType);
    if (!certType) {
      setError('Please select a valid certificate type');
      return;
    }

    const certificateData = {
      staffMember: employee.name,
      position: selectedPosition,
      certificateType: certType.name, // This will be mapped to certType in the backend
      issueDate: issueDate,
      expirationDate: expiryDate
    };

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/certificates/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(certificateData)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to add certificate');
      }

      setMessage('Certificate added successfully!');
      if (onCertificateAdded) {
        onCertificateAdded({ message: 'Certificate added successfully!' });
      }
      
      // Reset form
      setSelectedEmployee(null);
      setSelectedPosition('');
      setSelectedCertificateType('');
      setIssueDate('');
      setExpiryDate('');
      e.target.reset();
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredCertificates = certificates.filter(cert => {
    const employeeMatch = !selectedFilterEmployee || cert.staffMember === selectedFilterEmployee;
    const positionMatch = !selectedFilterPosition || cert.position === selectedFilterPosition;
    const certTypeMatch = !selectedFilterCertType || 
      cert.certType === selectedFilterCertType || 
      cert.CertType === selectedFilterCertType || 
      cert.certificateName === selectedFilterCertType ||
      cert.certificateType === selectedFilterCertType;
    return employeeMatch && positionMatch && certTypeMatch;
  }).sort((a, b) => {
    // Primary sort: Employee name (alphabetical)
    const nameComparison = a.staffMember.localeCompare(b.staffMember);
    if (nameComparison !== 0) return nameComparison;
    
    // Secondary sort: Certificate type (alphabetical)
    const aCertType = a.certType || a.CertType || a.certificateName || a.certificateType || '';
    const bCertType = b.certType || b.CertType || b.certificateName || b.certificateType || '';
    const certTypeComparison = aCertType.localeCompare(bCertType);
    if (certTypeComparison !== 0) return certTypeComparison;
    
    // Tertiary sort: Expiration date (newest first)
    return new Date(b.expirationDate) - new Date(a.expirationDate);
  });

  return (
    <div className="certificates-with-dashboard">
      {/* Dashboard Summary */}
      <div className="dashboard-summary">
        <div className="summary-header">
          <h2>Certificate Management Dashboard</h2>
          {isAdmin && (
            <button onClick={onViewAdmin} className="admin-btn">
              Administration
            </button>
          )}
        </div>

        {/* Key Metrics */}
        <div className="metrics-grid">
          <div className="metric-card primary">
            <div className="metric-header">
              <span className="metric-label">Overall Compliance</span>
              <div className="compliance-indicator">{dashboardStats.complianceRate}%</div>
            </div>
            <div className="metric-value">{dashboardStats.activeCertificates}</div>
            <div className="metric-subtitle">Active Certificates</div>
          </div>

          <div className={`metric-card ${dashboardStats.expiringSoon > 0 ? 'warning' : ''}`}>
            <div className="metric-header">
              <span className="metric-label">Expiring Soon</span>
            </div>
            <div className="metric-value">{dashboardStats.expiringSoon}</div>
            <div className="metric-subtitle">Next 30 Days</div>
          </div>

          <div className={`metric-card ${dashboardStats.expired > 0 ? 'danger' : ''}`}>
            <div className="metric-header">
              <span className="metric-label">Expired</span>
            </div>
            <div className="metric-value">{dashboardStats.expired}</div>
            <div className="metric-subtitle">Need Renewal</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Total Employees</span>
            </div>
            <div className="metric-value">{dashboardStats.totalEmployees}</div>
            <div className="metric-subtitle">Active Staff</div>
          </div>
        </div>

        {/* Insights Grid */}
        <div className="insights-grid">
          <div className="insight-card">
            <h3>Positions Needing Attention</h3>
            {complianceByPosition.length === 0 ? (
              <div className="no-data">No position data available</div>
            ) : (
              <div className="position-list">
                {complianceByPosition.map((pos, index) => (
                  <div key={index} className="position-item">
                    <div className="position-info">
                      <div className="position-name">{pos.position}</div>
                      <div className="position-department">{pos.department} • {pos.employees} employees</div>
                    </div>
                    <div className="position-stats">
                      <div className={`compliance-rate indicator-${
                        pos.complianceRate >= 90 ? 'excellent' :
                        pos.complianceRate >= 75 ? 'good' :
                        pos.complianceRate >= 50 ? 'warning' : 'danger'
                      }`}>
                        {pos.complianceRate}%
                      </div>
                      <div className="employee-count">{pos.completedRequiredCerts}/{pos.totalRequiredCerts} required</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="insight-card">
            <h3>Urgent Actions Required</h3>
            {urgentActions.length === 0 ? (
              <div className="no-data">No urgent actions required</div>
            ) : (
              <div className="action-list">
                {urgentActions.map((action, index) => (
                  <div key={index} className="action-item">
                    <div className="action-info">
                      <div className="employee-name">{action.employee}</div>
                      <div className="certificate-name">{action.certificate}</div>
                    </div>
                    <div className="action-urgency">
                      <div className={`days-left ${action.daysLeft <= 7 ? 'critical' : 'warning'}`}>
                        {action.daysLeft} days
                      </div>
                      <div className="expiry-date">{new Date(action.expiryDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Certificate Form Section */}
      <div className="certificate-form-section">
        <div className="form-header">
          <h3>Add New Certificate</h3>
        </div>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleCertificateSubmit} className="certificate-form">
          <div className="form-row">
            <div className="form-group">
              <label>Employee:</label>
              <select 
                value={selectedEmployee || ''} 
                onChange={(e) => setSelectedEmployee(e.target.value)}
                required
              >
                <option value="">Select Employee</option>
                {employees.filter(emp => emp.active !== false).map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Position:</label>
              <select 
                value={selectedPosition} 
                onChange={(e) => setSelectedPosition(e.target.value)}
                required
              >
                <option value="">Select Position</option>
                {positions.map(pos => (
                  <option key={pos._id} value={pos._id}>{pos.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Certificate Type:</label>
              <select 
                value={selectedCertificateType} 
                onChange={(e) => setSelectedCertificateType(e.target.value)}
                required
              >
                <option value="">Select Certificate Type</option>
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
                value={issueDate} 
                onChange={(e) => setIssueDate(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Expiration Date:</label>
              <input 
                type="date" 
                value={expiryDate} 
                onChange={(e) => setExpiryDate(e.target.value)}
                className={selectedCertificateType && issueDate ? "readonly-input" : ""}
                readOnly={selectedCertificateType && issueDate}
                required 
              />
              {selectedCertificateType && issueDate && (
                <div className="helper-text">
                  Auto-calculated based on certificate type validity period
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                Add Certificate
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setSelectedEmployee(null);
                  setSelectedPosition('');
                  setSelectedCertificateType('');
                  setIssueDate('');
                  setExpiryDate('');
                  setError('');
                  setMessage('');
                }}
                className="reset-btn"
              >
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Certificates Table Section */}
      <div className="certificates-table-section">
        <div className="table-header">
          <h3>Certificate Records ({filteredCertificates.length})</h3>
          <div className="filter-controls">
            <div className="filter-group">
              <label>Filter by Employee:</label>
              <select 
                value={selectedFilterEmployee} 
                onChange={(e) => setSelectedFilterEmployee(e.target.value)}
              >
                <option value="">All Employees</option>
                {[...new Set(certificates.map(cert => cert.staffMember))].map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Filter by Position:</label>
              <select 
                value={selectedFilterPosition || ''} 
                onChange={(e) => setSelectedFilterPosition(e.target.value)}
              >
                <option value="">All Positions</option>
                {positions.map(pos => (
                  <option key={pos._id} value={pos._id}>{pos.title}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Filter by Certificate:</label>
              <select 
                value={selectedFilterCertType} 
                onChange={(e) => setSelectedFilterCertType(e.target.value)}
              >
                <option value="">All Certificates</option>
                {[...new Set(certificates.map(cert => 
                  cert.certType || cert.CertType || cert.certificateName || cert.certificateType
                ))].filter(Boolean).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedFilterEmployee && (
          <div className="employee-actions">
            <button 
              onClick={() => onViewEmployee(selectedFilterEmployee)}
              className="view-employee-btn"
            >
              View {selectedFilterEmployee} Details
            </button>
          </div>
        )}

        <div className="table-container">
          <table className="certificates-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Certificate</th>
                <th>Issue Date</th>
                <th>Expiration Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCertificates.map(cert => {
                const expirationDate = new Date(cert.expirationDate);
                const today = new Date();
                const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
                
                let statusClass = 'status-active';
                if (daysUntilExpiration <= 0) statusClass = 'status-expired';
                else if (daysUntilExpiration <= 30) statusClass = 'status-expiring';

                const position = positions.find(pos => pos._id === cert.position) || {};
                const positionTitle = position.title || cert.position;

                const employee = employees.find(emp => emp.name === cert.staffMember);
                const isArchived = employee && employee.active === false;

                return (
                  <tr key={cert._id} className={`${statusClass} ${isArchived ? 'archived-employee' : ''}`}>
                    <td>
                      {cert.staffMember}
                      {isArchived && <span className="archived-badge">Archived</span>}
                    </td>
                    <td>{positionTitle}</td>
                    <td>{cert.certType || cert.CertType || cert.certificateName}</td>
                    <td>{new Date(cert.issueDate).toLocaleDateString()}</td>
                    <td>{new Date(cert.expirationDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge ${statusClass.replace('status-', '')}`}>
                        {cert.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => onCertificateDeleted(cert._id)}
                        className="delete-btn"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CertificatesWithDashboard;

// import {
//   useState,
//   useEffect
// } from 'react';

// const CertificatesWithDashboard = ({
//   token,
//   employees = [],
//   positions = [],
//   certificateTypes = [],
//   certificates = [],
//   isAdmin = false,
//   onViewEmployee,
//   onViewAdmin,
//   onCertificateAdded,
//   onCertificateDeleted
// }) => {
//   const [dashboardStats, setDashboardStats] = useState({
//     totalCertificates: 0,
//     activeCertificates: 0,
//     expiringSoon: 0,
//     expired: 0,
//     totalEmployees: 0,
//     complianceRate: 0
//   });
//   const [complianceByPosition, setComplianceByPosition] = useState([]);
//   const [urgentActions, setUrgentActions] = useState([]);
//   const [positionRequirements, setPositionRequirements] = useState([]);
//   const [selectedFilterEmployee, setSelectedFilterEmployee] = useState('');
//   const [selectedFilterCertType, setSelectedFilterCertType] = useState('');
//   const [selectedFilterPosition, setSelectedFilterPosition] = useState('');
//   const [selectedEmployee, setSelectedEmployee] = useState(null);
//   const [selectedPosition, setSelectedPosition] = useState('');
//   const [selectedCertificateType, setSelectedCertificateType] = useState('');
//   const [issueDate, setIssueDate] = useState('');
//   const [expiryDate, setExpiryDate] = useState('');
//   const [error, setError] = useState('');
//   const [message, setMessage] = useState('');

//   useEffect(() => {
//     calculateDashboardStats();
//   }, [certificates, employees, positions, positionRequirements]);

//   // Fetch position requirements when component mounts
//   useEffect(() => {
//     fetchPositionRequirements();
//   }, [token]);

//   // Auto-calculate expiry date when certificate type or issue date changes
//   useEffect(() => {
//     if (selectedCertificateType && issueDate) {
//       const certType = certificateTypes.find(cert => cert._id === selectedCertificateType);
//       if (certType && certType.validityPeriod) {
//         const issue = new Date(issueDate);
//         const expiry = new Date(issue);
//         expiry.setMonth(expiry.getMonth() + certType.validityPeriod);
//         setExpiryDate(expiry.toISOString().split('T')[0]);
//       }
//     }
//   }, [selectedCertificateType, issueDate, certificateTypes]);

//   const fetchPositionRequirements = async () => {
//     if (!token) return;
    
//     try {
//       const response = await fetch('https://training-cert-tracker.onrender.com/api/positionRequirements', {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       });
      
//       if (response.ok) {
//         const requirements = await response.json();
//         console.log('Position requirements fetched:', requirements);
//         setPositionRequirements(requirements || []);
//       } else {
//         console.warn('Failed to fetch position requirements:', response.status);
//         setPositionRequirements([]);
//       }
//     } catch (error) {
//       console.error('Error fetching position requirements:', error);
//       setPositionRequirements([]);
//     }
//   };

//   const calculateDashboardStats = () => {
//     console.log('Starting dashboard calculation with:', {
//       certificatesCount: certificates.length,
//       employeesCount: employees.length,
//       positionsCount: positions.length,
//       requirementsCount: positionRequirements.length
//     });

//     const today = new Date();
//     const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

//     const totalCertificates = certificates.length;
//     const activeCertificates = certificates.filter(cert => 
//       cert.status === 'ACTIVE' || cert.status === 'Active'
//     ).length;
//     const expiringSoon = certificates.filter(cert => {
//       const expiryDate = new Date(cert.expirationDate);
//       const isActive = cert.status === 'ACTIVE' || cert.status === 'Active';
//       return isActive && expiryDate > today && expiryDate <= thirtyDaysFromNow;
//     }).length;
//     const expired = certificates.filter(cert => 
//       cert.status === 'EXPIRED' || cert.status === 'Expired'
//     ).length;

//     const activeEmployees = employees.filter(emp => emp.active !== false);
//     const totalEmployees = activeEmployees.length;

//     let requiredCertCount = 0;
//     let activeRequiredCertCount = 0;

//     console.log('Active employees:', activeEmployees.length);
//     console.log('Position requirements:', positionRequirements);

//     activeEmployees.forEach(emp => {
//       if (emp.positions && Array.isArray(emp.positions)) {
//         emp.positions.forEach(posId => {
//           if (posId) { // Check if posId exists
//             const positionId = typeof posId === 'object' ? posId._id : posId;
//             if (positionId) { // Check if positionId exists
//               const position = positions.find(p => p._id === positionId);
              
//               if (position) {
//                 // Find requirements for this position
//                 const requirements = positionRequirements.filter(req => {
//                   if (!req || !req.position) return false;
//                   const reqPositionId = typeof req.position === 'object' ? req.position._id : req.position;
//                   return reqPositionId === positionId && req.isRequired && req.active;
//                 });
                
//                 console.log(`Employee ${emp.name}, Position ${position.title}, Requirements:`, requirements.length);
                
//                 requirements.forEach(requirement => {
//                   requiredCertCount++;
//                   const hasActive = certificates.some(cert => {
//                     const isActive = cert.status === 'ACTIVE' || cert.status === 'Active';
//                     const certTypeMatch = cert.certType === requirement.certificateType || 
//                                          cert.CertType === requirement.certificateType || 
//                                          cert.certificateName === requirement.certificateType || 
//                                          cert.certificateType === requirement.certificateType;
//                     return cert.staffMember === emp.name && certTypeMatch && isActive;
//                   });
//                   if (hasActive) activeRequiredCertCount++;
//                 });
//               }
//             }
//           }
//         });
//       }
//     });

//     console.log('Compliance calculation:', {
//       requiredCertCount,
//       activeRequiredCertCount,
//       complianceRate: requiredCertCount > 0 ? Math.round((activeRequiredCertCount / requiredCertCount) * 100) : 0
//     });

//     const complianceRate = requiredCertCount > 0
//       ? Math.round((activeRequiredCertCount / requiredCertCount) * 100)
//       : 0;

//     setDashboardStats({
//       totalCertificates,
//       activeCertificates,
//       expiringSoon,
//       expired,
//       totalEmployees,
//       complianceRate
//     });

//     const positionStats = [];
//     positions.forEach(position => {
//       const positionCerts = certificates.filter(cert => cert.position === position._id);
//       const activeCerts = positionCerts.filter(cert => 
//         cert.status === 'ACTIVE' || cert.status === 'Active'
//       );
//       const employeesInPosition = activeEmployees.filter(emp =>
//         emp.positions && Array.isArray(emp.positions) && emp.positions.some(pos => {
//           if (!pos) return false;
//           const empPosId = typeof pos === 'object' ? pos._id : pos;
//           return empPosId === position._id;
//         })
//       );
      
//       // Get requirements for this position
//       const requirements = positionRequirements.filter(req => {
//         if (!req || !req.position) return false;
//         const reqPositionId = typeof req.position === 'object' ? req.position._id : req.position;
//         return reqPositionId === position._id && req.isRequired && req.active;
//       });
      
//       if (employeesInPosition.length > 0 && requirements.length > 0) {
//         // Calculate compliance based on required certificates vs actual certificates
//         let totalRequiredCerts = employeesInPosition.length * requirements.length;
//         let completedRequiredCerts = 0;
        
//         employeesInPosition.forEach(emp => {
//           requirements.forEach(requirement => {
//             const hasValidCert = certificates.some(cert => {
//               const isActive = cert.status === 'ACTIVE' || cert.status === 'Active';
//               const certTypeMatch = cert.certType === requirement.certificateType || 
//                                    cert.CertType === requirement.certificateType || 
//                                    cert.certificateName === requirement.certificateType || 
//                                    cert.certificateType === requirement.certificateType;
//               return cert.staffMember === emp.name && certTypeMatch && isActive;
//             });
//             if (hasValidCert) completedRequiredCerts++;
//           });
//         });
        
//         const complianceRate = totalRequiredCerts > 0
//           ? Math.round((completedRequiredCerts / totalRequiredCerts) * 100)
//           : 0;
        
//         positionStats.push({
//           position: position.title,
//           department: position.department || 'No Department',
//           employees: employeesInPosition.length,
//           totalCerts: positionCerts.length,
//           activeCerts: activeCerts.length,
//           requiredCerts: requirements.length,
//           totalRequiredCerts,
//           completedRequiredCerts,
//           complianceRate
//         });
//       }
//     });
//     positionStats.sort((a, b) => a.complianceRate - b.complianceRate);
//     setComplianceByPosition(positionStats.slice(0, 5));

//     const urgent = certificates
//       .filter(cert => {
//         const expiryDate = new Date(cert.expirationDate);
//         const isActive = cert.status === 'ACTIVE' || cert.status === 'Active';
//         return isActive && expiryDate > today && expiryDate <= thirtyDaysFromNow;
//       })
//       .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
//       .slice(0, 5)
//       .map(cert => ({
//         employee: cert.staffMember,
//         certificate: cert.certType || cert.CertType || cert.certificateName || cert.certificateType,
//         expiryDate: cert.expirationDate,
//         daysLeft: Math.ceil((new Date(cert.expirationDate) - today) / (1000 * 60 * 60 * 24))
//       }));

//     setUrgentActions(urgent);
//   };

//   const handleCertificateSubmit = async (e) => {
//     e.preventDefault();
//     setError('');
//     setMessage('');

//     if (!selectedEmployee || !selectedPosition || !issueDate || !expiryDate) {
//       setError('Please fill in all fields');
//       return;
//     }

//     const employee = employees.find(emp => emp._id === selectedEmployee);
//     if (!employee) {
//       setError('Please select a valid employee');
//       return;
//     }

//     const position = positions.find(pos => pos._id === selectedPosition);
//     if (!position) {
//       setError('Please select a valid position');
//       return;
//     }

//     const certType = certificateTypes.find(cert => cert._id === selectedCertificateType);
//     if (!certType) {
//       setError('Please select a valid certificate type');
//       return;
//     }

//     const certificateData = {
//       staffMember: employee.name,
//       position: selectedPosition,
//       certificateType: certType.name, // This will be mapped to certType in the backend
//       issueDate: issueDate,
//       expirationDate: expiryDate
//     };

//     try {
//       const response = await fetch('https://training-cert-tracker.onrender.com/api/certificates/upload', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(certificateData)
//       });

//       if (!response.ok) {
//         const result = await response.json();
//         throw new Error(result.message || 'Failed to add certificate');
//       }

//       setMessage('Certificate added successfully!');
//       if (onCertificateAdded) {
//         onCertificateAdded({ message: 'Certificate added successfully!' });
//       }
      
//       // Reset form
//       setSelectedEmployee(null);
//       setSelectedPosition('');
//       setSelectedCertificateType('');
//       setIssueDate('');
//       setExpiryDate('');
//       e.target.reset();
//     } catch (err) {
//       setError(err.message);
//     }
//   };

//   const filteredCertificates = certificates.filter(cert => {
//     const employeeMatch = !selectedFilterEmployee || cert.staffMember === selectedFilterEmployee;
//     const positionMatch = !selectedFilterPosition || cert.position === selectedFilterPosition;
//     const certTypeMatch = !selectedFilterCertType || 
//       cert.certType === selectedFilterCertType || 
//       cert.CertType === selectedFilterCertType || 
//       cert.certificateName === selectedFilterCertType ||
//       cert.certificateType === selectedFilterCertType;
//     return employeeMatch && positionMatch && certTypeMatch;
//   });

//   return (
//     <div className="certificates-with-dashboard">
//       {/* Dashboard Summary */}
//       <div className="dashboard-summary">
//         <div className="summary-header">
//           <h2>Certificate Management Dashboard</h2>
//           {isAdmin && (
//             <button onClick={onViewAdmin} className="admin-btn">
//               Administration
//             </button>
//           )}
//         </div>

//         {/* Key Metrics */}
//         <div className="metrics-grid">
//           <div className="metric-card primary">
//             <div className="metric-header">
//               <span className="metric-label">Overall Compliance</span>
//               <div className="compliance-indicator">{dashboardStats.complianceRate}%</div>
//             </div>
//             <div className="metric-value">{dashboardStats.activeCertificates}</div>
//             <div className="metric-subtitle">Active Certificates</div>
//           </div>

//           <div className={`metric-card ${dashboardStats.expiringSoon > 0 ? 'warning' : ''}`}>
//             <div className="metric-header">
//               <span className="metric-label">Expiring Soon</span>
//             </div>
//             <div className="metric-value">{dashboardStats.expiringSoon}</div>
//             <div className="metric-subtitle">Next 30 Days</div>
//           </div>

//           <div className={`metric-card ${dashboardStats.expired > 0 ? 'danger' : ''}`}>
//             <div className="metric-header">
//               <span className="metric-label">Expired</span>
//             </div>
//             <div className="metric-value">{dashboardStats.expired}</div>
//             <div className="metric-subtitle">Need Renewal</div>
//           </div>

//           <div className="metric-card">
//             <div className="metric-header">
//               <span className="metric-label">Total Employees</span>
//             </div>
//             <div className="metric-value">{dashboardStats.totalEmployees}</div>
//             <div className="metric-subtitle">Active Staff</div>
//           </div>
//         </div>

//         {/* Insights Grid */}
//         <div className="insights-grid">
//           <div className="insight-card">
//             <h3>Positions Needing Attention</h3>
//             {complianceByPosition.length === 0 ? (
//               <div className="no-data">No position data available</div>
//             ) : (
//               <div className="position-list">
//                 {complianceByPosition.map((pos, index) => (
//                   <div key={index} className="position-item">
//                     <div className="position-info">
//                       <div className="position-name">{pos.position}</div>
//                       <div className="position-department">{pos.department} • {pos.employees} employees</div>
//                     </div>
//                     <div className="position-stats">
//                       <div className={`compliance-rate indicator-${
//                         pos.complianceRate >= 90 ? 'excellent' :
//                         pos.complianceRate >= 75 ? 'good' :
//                         pos.complianceRate >= 50 ? 'warning' : 'danger'
//                       }`}>
//                         {pos.complianceRate}%
//                       </div>
//                       <div className="employee-count">{pos.completedRequiredCerts}/{pos.totalRequiredCerts} required</div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>

//           <div className="insight-card">
//             <h3>Urgent Actions Required</h3>
//             {urgentActions.length === 0 ? (
//               <div className="no-data">No urgent actions required</div>
//             ) : (
//               <div className="action-list">
//                 {urgentActions.map((action, index) => (
//                   <div key={index} className="action-item">
//                     <div className="action-info">
//                       <div className="employee-name">{action.employee}</div>
//                       <div className="certificate-name">{action.certificate}</div>
//                     </div>
//                     <div className="action-urgency">
//                       <div className={`days-left ${action.daysLeft <= 7 ? 'critical' : 'warning'}`}>
//                         {action.daysLeft} days
//                       </div>
//                       <div className="expiry-date">{new Date(action.expiryDate).toLocaleDateString()}</div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* Certificate Form Section */}
//       <div className="certificate-form-section">
//         <div className="form-header">
//           <h3>Add New Certificate</h3>
//         </div>

//         {error && <div className="error-message">{error}</div>}
//         {message && <div className="success-message">{message}</div>}

//         <form onSubmit={handleCertificateSubmit} className="certificate-form">
//           <div className="form-row">
//             <div className="form-group">
//               <label>Employee:</label>
//               <select 
//                 value={selectedEmployee || ''} 
//                 onChange={(e) => setSelectedEmployee(e.target.value)}
//                 required
//               >
//                 <option value="">Select Employee</option>
//                 {employees.filter(emp => emp.active !== false).map(emp => (
//                   <option key={emp._id} value={emp._id}>{emp.name}</option>
//                 ))}
//               </select>
//             </div>

//             <div className="form-group">
//               <label>Position:</label>
//               <select 
//                 value={selectedPosition} 
//                 onChange={(e) => setSelectedPosition(e.target.value)}
//                 required
//               >
//                 <option value="">Select Position</option>
//                 {positions.map(pos => (
//                   <option key={pos._id} value={pos._id}>{pos.title}</option>
//                 ))}
//               </select>
//             </div>
//           </div>

//           <div className="form-row">
//             <div className="form-group">
//               <label>Certificate Type:</label>
//               <select 
//                 value={selectedCertificateType} 
//                 onChange={(e) => setSelectedCertificateType(e.target.value)}
//                 required
//               >
//                 <option value="">Select Certificate Type</option>
//                 {certificateTypes.map(cert => (
//                   <option key={cert._id} value={cert._id}>
//                     {cert.name} ({cert.validityPeriod} months)
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div className="form-group">
//               <label>Issue Date:</label>
//               <input 
//                 type="date" 
//                 value={issueDate} 
//                 onChange={(e) => setIssueDate(e.target.value)}
//                 required 
//               />
//             </div>
//           </div>

//           <div className="form-row">
//             <div className="form-group">
//               <label>Expiration Date:</label>
//               <input 
//                 type="date" 
//                 value={expiryDate} 
//                 onChange={(e) => setExpiryDate(e.target.value)}
//                 className={selectedCertificateType && issueDate ? "readonly-input" : ""}
//                 readOnly={selectedCertificateType && issueDate}
//                 required 
//               />
//               {selectedCertificateType && issueDate && (
//                 <div className="helper-text">
//                   Auto-calculated based on certificate type validity period
//                 </div>
//               )}
//             </div>

//             <div className="form-actions">
//               <button type="submit" className="submit-btn">
//                 Add Certificate
//               </button>
//               <button 
//                 type="button" 
//                 onClick={() => {
//                   setSelectedEmployee(null);
//                   setSelectedPosition('');
//                   setSelectedCertificateType('');
//                   setIssueDate('');
//                   setExpiryDate('');
//                   setError('');
//                   setMessage('');
//                 }}
//                 className="reset-btn"
//               >
//                 Reset
//               </button>
//             </div>
//           </div>
//         </form>
//       </div>

//       {/* Certificates Table Section */}
//       <div className="certificates-table-section">
//         <div className="table-header">
//           <h3>Certificate Records ({filteredCertificates.length})</h3>
//           <div className="filter-controls">
//             <div className="filter-group">
//               <label>Filter by Employee:</label>
//               <select 
//                 value={selectedFilterEmployee} 
//                 onChange={(e) => setSelectedFilterEmployee(e.target.value)}
//               >
//                 <option value="">All Employees</option>
//                 {[...new Set(certificates.map(cert => cert.staffMember))].map(name => (
//                   <option key={name} value={name}>{name}</option>
//                 ))}
//               </select>
//             </div>

//             <div className="filter-group">
//               <label>Filter by Position:</label>
//               <select 
//                 value={selectedFilterPosition || ''} 
//                 onChange={(e) => setSelectedFilterPosition(e.target.value)}
//               >
//                 <option value="">All Positions</option>
//                 {positions.map(pos => (
//                   <option key={pos._id} value={pos._id}>{pos.title}</option>
//                 ))}
//               </select>
//             </div>

//             <div className="filter-group">
//               <label>Filter by Certificate:</label>
//               <select 
//                 value={selectedFilterCertType} 
//                 onChange={(e) => setSelectedFilterCertType(e.target.value)}
//               >
//                 <option value="">All Certificates</option>
//                 {[...new Set(certificates.map(cert => 
//                   cert.certType || cert.CertType || cert.certificateName || cert.certificateType
//                 ))].filter(Boolean).map(name => (
//                   <option key={name} value={name}>{name}</option>
//                 ))}
//               </select>
//             </div>
//           </div>
//         </div>

//         {selectedFilterEmployee && (
//           <div className="employee-actions">
//             <button 
//               onClick={() => onViewEmployee(selectedFilterEmployee)}
//               className="view-employee-btn"
//             >
//               View {selectedFilterEmployee} Details
//             </button>
//           </div>
//         )}

//         <div className="table-container">
//           <table className="certificates-table">
//             <thead>
//               <tr>
//                 <th>Employee</th>
//                 <th>Position</th>
//                 <th>Certificate</th>
//                 <th>Issue Date</th>
//                 <th>Expiration Date</th>
//                 <th>Status</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredCertificates.map(cert => {
//                 const expirationDate = new Date(cert.expirationDate);
//                 const today = new Date();
//                 const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
                
//                 let statusClass = 'status-active';
//                 if (daysUntilExpiration <= 0) statusClass = 'status-expired';
//                 else if (daysUntilExpiration <= 30) statusClass = 'status-expiring';

//                 const position = positions.find(pos => pos._id === cert.position) || {};
//                 const positionTitle = position.title || cert.position;

//                 const employee = employees.find(emp => emp.name === cert.staffMember);
//                 const isArchived = employee && employee.active === false;

//                 return (
//                   <tr key={cert._id} className={`${statusClass} ${isArchived ? 'archived-employee' : ''}`}>
//                     <td>
//                       {cert.staffMember}
//                       {isArchived && <span className="archived-badge">Archived</span>}
//                     </td>
//                     <td>{positionTitle}</td>
//                     <td>{cert.certType || cert.CertType || cert.certificateName}</td>
//                     <td>{new Date(cert.issueDate).toLocaleDateString()}</td>
//                     <td>{new Date(cert.expirationDate).toLocaleDateString()}</td>
//                     <td>
//                       <span className={`status-badge ${statusClass.replace('status-', '')}`}>
//                         {cert.status}
//                       </span>
//                     </td>
//                     <td>
//                       <button
//                         onClick={() => onCertificateDeleted(cert._id)}
//                         className="delete-btn"
//                       >
//                         Delete
//                       </button>
//                     </td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default CertificatesWithDashboard;
