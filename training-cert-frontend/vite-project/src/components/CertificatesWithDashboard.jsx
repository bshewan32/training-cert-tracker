import { useState, useEffect } from 'react';
import RenewalModal from './RenewalModal';

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
  onCertificateDeleted,
  onRefreshData
}) => {
  const [dashboardStats, setDashboardStats] = useState({
    totalCertificates: 0,
    activeCertificates: 0,
    expiringSoon: 0,
    expired: 0,
    totalEmployees: 0,
    complianceRate: 0
  });
  const [certificateFile, setCertificateFile] = useState(null);
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
  const [renewingCert, setRenewingCert] = useState(null); // NEW: For renewal modal

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
          if (posId) {
            const positionId = typeof posId === 'object' ? posId._id : posId;
            if (positionId) {
              const position = positions.find(p => p._id === positionId);
              
              if (position) {
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
      
      const requirements = positionRequirements.filter(req => {
        if (!req || !req.position) return false;
        const reqPositionId = typeof req.position === 'object' ? req.position._id : req.position;
        return reqPositionId === position._id && req.isRequired && req.active;
      });
      
      if (employeesInPosition.length > 0 && requirements.length > 0) {
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

    try {
      let onedriveFileId = null;
      let onedriveFilePath = null;
      
      if (certificateFile) {
        console.log('Uploading file to OneDrive...');
        try {
          const fileFormData = new FormData();
          fileFormData.append('file', certificateFile);
          fileFormData.append('employeeName', employee.name);
          fileFormData.append('certificateType', certType.name);
          fileFormData.append('issueDate', issueDate);

          const fileUploadResponse = await fetch('https://training-cert-tracker.onrender.com/api/certificates/upload-image', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: fileFormData
          });

          if (!fileUploadResponse.ok) {
            const fileError = await fileUploadResponse.json();
            throw new Error(fileError.message || 'Failed to upload certificate file');
          }

          const fileUploadResult = await fileUploadResponse.json();
          onedriveFileId = fileUploadResult.fileId;
          onedriveFilePath = fileUploadResult.filePath;
          
          console.log('File uploaded successfully:', { onedriveFileId, onedriveFilePath });
        } catch (fileError) {
          console.error('File upload error:', fileError);
          setError(`Warning: Certificate will be created but file upload failed: ${fileError.message}`);
        }
      }

      const certificateData = {
        staffMember: employee.name,
        position: selectedPosition,
        certificateType: certType.name,
        issueDate: issueDate,
        expirationDate: expiryDate,
        onedriveFileId: onedriveFileId,
        onedriveFilePath: onedriveFilePath
      };

      console.log('Creating certificate with data:', certificateData);

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

      const successMsg = certificateFile 
        ? 'Certificate and image added successfully!' 
        : 'Certificate added successfully!';
      setMessage(successMsg);
      
      if (onCertificateAdded) {
        onCertificateAdded({ message: successMsg });
      }
      
      // Reset form
      setSelectedEmployee(null);
      setSelectedPosition('');
      setSelectedCertificateType('');
      setIssueDate('');
      setExpiryDate('');
      setCertificateFile(null);
      
      const fileInput = document.getElementById('certificateFile');
      if (fileInput) {
        fileInput.value = '';
      }
      
      e.target.reset();
    } catch (err) {
      setError(err.message);
    }
  };

  // NEW: Handle delete certificate
  const handleDelete = async (certId) => {
    if (!window.confirm('Are you sure you want to delete this certificate?')) {
      return;
    }

    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/certificates/${certId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete certificate');
      }

      setMessage('Certificate deleted successfully');
      setTimeout(() => setMessage(''), 3000);
      
      if (onCertificateDeleted) {
        onCertificateDeleted(certId);
      }
      
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err) {
      setError(err.message || 'Error deleting certificate');
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
    const nameComparison = (a.staffMember || '').localeCompare(b.staffMember || '');
    if (nameComparison !== 0) return nameComparison;
    
    const aCertType = a.certType || a.CertType || a.certificateName || a.certificateType || '';
    const bCertType = b.certType || b.CertType || b.certificateName || b.certificateType || '';
    
    const certTypeComparison = aCertType.localeCompare(bCertType);
    if (certTypeComparison !== 0) return certTypeComparison;
    
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

            <div className="form-group">
              <label htmlFor="certificateFile">Certificate Image (Optional):</label>
              <input
                type="file"
                id="certificateFile"
                name="certificateFile"
                accept="image/*,.pdf"
                onChange={(e) => setCertificateFile(e.target.files[0])}
                className="file-input"
              />
              <div className="helper-text">
                Upload an image or PDF of the certificate (max 10MB)
              </div>
              {certificateFile && (
                <div className="file-selected">
                  Selected: {certificateFile.name}
                </div>
              )}
            </div>
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
                setCertificateFile(null);
                setError('');
                setMessage('');
                const fileInput = document.getElementById('certificateFile');
                if (fileInput) fileInput.value = '';
              }}
              className="reset-btn"
            >
              Reset
            </button>
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
                {[...new Set(certificates.map(cert => cert.staffMember))]
                  .filter(Boolean)
                  .sort()
                  .map(name => (
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
                ))].filter(Boolean).sort().map(name => (
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
                <th>Image</th>
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
                    <td>{cert.certType || cert.CertType || cert.certificateName || cert.certificateType}</td>
                    <td>{new Date(cert.issueDate).toLocaleDateString()}</td>
                    <td>{new Date(cert.expirationDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge ${statusClass.replace('status-', '')}`}>
                        {cert.status}
                      </span>
                    </td>
                    <td>
                      {cert.onedriveFileId ? (
                        <button className="view-image-btn">
                          📎 View
                        </button>
                      ) : (
                        <span className="no-image">No Image</span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button
                        onClick={() => setRenewingCert(cert)}
                        className="renew-btn"
                        title="Renew this certificate"
                      >
                        🔄 Renew
                      </button>
                      <button
                        onClick={() => handleDelete(cert._id)}
                        className="delete-btn"
                        title="Delete this certificate"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renewal Modal */}
      {renewingCert && (
        <RenewalModal
          certificate={renewingCert}
          token={token}
          certificateTypes={certificateTypes}
          onClose={() => setRenewingCert(null)}
          onSuccess={async () => {
            setRenewingCert(null);
            setMessage('Certificate renewed successfully!');
            setTimeout(() => setMessage(''), 3000);
            if (onRefreshData) {
              await onRefreshData();
            }
          }}
        />
      )}

      <style jsx>{`
        .certificates-with-dashboard {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }

        .dashboard-summary {
          background: white;
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 30px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e2e8f0;
        }

        .summary-header h2 {
          margin: 0;
          color: #1a202c;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .admin-btn {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .admin-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 30px;
        }

        .metric-card {
          background: #f7fafc;
          border-radius: 10px;
          padding: 20px;
          border: 2px solid #e2e8f0;
          transition: all 0.2s;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .metric-card.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
        }

        .metric-card.warning {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-color: #f59e0b;
        }

        .metric-card.danger {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          border-color: #dc2626;
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .metric-label {
          font-weight: 600;
          font-size: 0.9rem;
          color: #4a5568;
        }

        .metric-card.primary .metric-label {
          color: rgba(255, 255, 255, 0.9);
        }

        .compliance-indicator {
          font-size: 1.5rem;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.2);
          padding: 5px 12px;
          border-radius: 8px;
        }

        .metric-value {
          font-size: 2.5rem;
          font-weight: 800;
          color: #2d3748;
          margin-bottom: 5px;
        }

        .metric-card.warning .metric-value {
          color: #b45309;
        }

        .metric-card.danger .metric-value {
          color: #991b1b;
        }

        .metric-subtitle {
          font-size: 0.85rem;
          color: #718096;
        }

        .metric-card.primary .metric-subtitle {
          color: rgba(255, 255, 255, 0.8);
        }

        .insights-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .insight-card {
          background: #f7fafc;
          border-radius: 10px;
          padding: 20px;
          border: 2px solid #e2e8f0;
        }

        .insight-card h3 {
          margin: 0 0 15px 0;
          color: #2d3748;
          font-size: 1.1rem;
          font-weight: 700;
        }

        .no-data {
          text-align: center;
          color: #a0aec0;
          padding: 20px;
          font-style: italic;
        }

        .position-list, .action-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .position-item, .action-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .position-info, .action-info {
          flex: 1;
        }

        .position-name, .employee-name {
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .position-department, .certificate-name {
          font-size: 0.85rem;
          color: #718096;
        }

        .compliance-rate {
          font-weight: 800;
          font-size: 1.2rem;
          margin-bottom: 4px;
        }

        .indicator-excellent { color: #10b981; }
        .indicator-good { color: #3b82f6; }
        .indicator-warning { color: #f59e0b; }
        .indicator-danger { color: #ef4444; }

        .employee-count {
          font-size: 0.75rem;
          color: #718096;
          text-transform: uppercase;
        }

        .days-left {
          font-weight: 800;
          font-size: 1.2rem;
          margin-bottom: 4px;
        }

        .days-left.critical { color: #dc2626; }
        .days-left.warning { color: #f59e0b; }

        .expiry-date {
          font-size: 0.75rem;
          color: #718096;
        }

        .certificate-form-section, .certificates-table-section {
          background: white;
          border-radius: 12px;
          padding: 25px;
          margin-bottom: 30px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .form-header h3 {
          margin: 0 0 20px 0;
          color: #1a202c;
          font-size: 1.25rem;
          font-weight: 700;
          padding-bottom: 15px;
          border-bottom: 2px solid #e2e8f0;
        }

        .certificate-form {
          background: #f7fafc;
          padding: 25px;
          border-radius: 10px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          font-weight: 600;
          color: #4a5568;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }

        .form-group input,
        .form-group select {
          padding: 12px;
          border: 2px solid #cbd5e0;
          border-radius: 8px;
          font-size: 0.95rem;
          background: white;
          transition: all 0.2s;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .readonly-input {
          background: #edf2f7 !important;
          color: #718096;
        }

        .helper-text {
          margin-top: 5px;
          font-size: 0.8rem;
          color: #718096;
        }

        .file-input {
          padding: 10px;
          border: 2px dashed #cbd5e0 !important;
          background: #f7fafc !important;
          cursor: pointer;
        }

        .file-selected {
          background: #d1fae5;
          color: #065f46;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          margin-top: 8px;
          font-weight: 500;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 25px;
        }

        .submit-btn, .reset-btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.95rem;
        }

        .submit-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .submit-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .reset-btn {
          background: #e2e8f0;
          color: #4a5568;
        }

        .reset-btn:hover {
          background: #cbd5e0;
        }

        .error-message {
          background: #fee2e2;
          color: #991b1b;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 15px;
          border-left: 4px solid #dc2626;
        }

        .success-message {
          background: #d1fae5;
          color: #065f46;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 15px;
          border-left: 4px solid #10b981;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .table-header h3 {
          margin: 0;
          color: #1a202c;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .filter-controls {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-group label {
          font-weight: 600;
          color: #4a5568;
          font-size: 0.85rem;
          white-space: nowrap;
        }

        .filter-group select {
          padding: 8px 12px;
          border: 2px solid #cbd5e0;
          border-radius: 6px;
          font-size: 0.9rem;
          min-width: 160px;
        }

        .employee-actions {
          margin-bottom: 20px;
        }

        .view-employee-btn {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .view-employee-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .table-container {
          overflow-x: auto;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
        }

        .certificates-table {
          width: 100%;
          border-collapse: collapse;
        }

        .certificates-table th {
          background: #f7fafc;
          padding: 12px 15px;
          text-align: left;
          font-weight: 700;
          color: #4a5568;
          border-bottom: 2px solid #cbd5e0;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .certificates-table td {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.9rem;
          color: #2d3748;
        }

        .certificates-table tr:hover {
          background: #f7fafc;
        }

        .certificates-table tr.status-active {
          background: #ecfdf5;
        }

        .certificates-table tr.status-expiring {
          background: #fef3c7;
        }

        .certificates-table tr.status-expired {
          background: #fee2e2;
        }

        .certificates-table tr.archived-employee {
          opacity: 0.6;
          background: #faf5ff;
        }

        .archived-badge {
          background: #fbbf24;
          color: #78350f;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          margin-left: 8px;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .status-badge.active {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.expiring {
          background: #fef3c7;
          color: #b45309;
        }

        .status-badge.expired {
          background: #fee2e2;
          color: #991b1b;
        }

        .view-image-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.2s;
        }

        .view-image-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }

        .no-image {
          color: #a0aec0;
          font-style: italic;
          font-size: 0.8rem;
        }

        .actions-cell {
          white-space: nowrap;
        }

        .renew-btn, .delete-btn {
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          margin-right: 6px;
          transition: all 0.2s;
        }

        .renew-btn {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .renew-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        .delete-btn {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
        }

        .delete-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
        }

        @media (max-width: 1024px) {
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .insights-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .filter-controls {
            width: 100%;
            flex-direction: column;
          }

          .filter-group {
            width: 100%;
            flex-direction: column;
            align-items: flex-start;
          }

          .filter-group select {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default CertificatesWithDashboard;