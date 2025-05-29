import { useState, useEffect } from 'react';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dashboard stats
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
  
  // Form state
  const [formData, setFormData] = useState({
    staffMember: '',
    position: '',
    certificateType: '',
    issueDate: new Date().toISOString().split('T')[0],
    expirationDate: ''
  });
  
  // Filters
  const [selectedFilterEmployee, setSelectedFilterEmployee] = useState('');
  const [selectedFilterCertType, setSelectedFilterCertType] = useState('');
  
  // Selected employee's positions
  const [employeePositions, setEmployeePositions] = useState([]);
  
  // Calculate dashboard stats when data changes
  useEffect(() => {
    calculateDashboardStats();
  }, [certificates, employees, positions]);
  
  // Update employee positions when employee changes
  useEffect(() => {
    if (formData.staffMember) {
      const selectedEmployee = employees.find(emp => emp._id === formData.staffMember);
      if (selectedEmployee && selectedEmployee.positions) {
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
  
  const calculateDashboardStats = () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    // Basic certificate stats
    const totalCertificates = certificates.length;
    const activeCertificates = certificates.filter(cert => cert.status === 'Active').length;
    const expiringSoon = certificates.filter(cert => {
      const expiryDate = new Date(cert.expirationDate);
      return expiryDate > today && expiryDate <= thirtyDaysFromNow;
    }).length;
    const expired = certificates.filter(cert => cert.status === 'Expired').length;
    
    // Employee stats (only active employees)
    const activeEmployees = employees.filter(emp => emp.active !== false);
    const totalEmployees = activeEmployees.length;
    
    // Compliance rate calculation (simplified)
    const complianceRate = totalCertificates > 0 
      ? Math.round((activeCertificates / totalCertificates) * 100) 
      : 0;
    
    setDashboardStats({
      totalCertificates,
      activeCertificates,
      expiringSoon,
      expired,
      totalEmployees,
      complianceRate
    });
    
    // Calculate compliance by position
    const positionStats = [];
    positions.forEach(position => {
      const positionCerts = certificates.filter(cert => cert.position === position._id);
      const activeCerts = positionCerts.filter(cert => cert.status === 'Active');
      const employeesInPosition = activeEmployees.filter(emp => 
        emp.positions && emp.positions.some(pos => 
          (typeof pos === 'object' ? pos._id : pos) === position._id
        )
      );
      
      if (employeesInPosition.length > 0) {
        positionStats.push({
          position: position.title,
          department: position.department || 'No Department',
          employees: employeesInPosition.length,
          totalCerts: positionCerts.length,
          activeCerts: activeCerts.length,
          complianceRate: positionCerts.length > 0 
            ? Math.round((activeCerts.length / positionCerts.length) * 100) 
            : 0
        });
      }
    });
    
    // Sort by compliance rate (lowest first)
    positionStats.sort((a, b) => a.complianceRate - b.complianceRate);
    setComplianceByPosition(positionStats.slice(0, 5)); // Top 5 positions needing attention
    
    // Urgent actions (expiring certificates)
    const urgent = certificates
      .filter(cert => {
        const expiryDate = new Date(cert.expirationDate);
        return expiryDate > today && expiryDate <= thirtyDaysFromNow;
      })
      .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
      .slice(0, 5)
      .map(cert => ({
        employee: cert.staffMember,
        certificate: cert.certificateType || cert.certificateName,
        expiryDate: cert.expirationDate,
        daysLeft: Math.ceil((new Date(cert.expirationDate) - today) / (1000 * 60 * 60 * 24))
      }));
    
    setUrgentActions(urgent);
  };
  
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
  const handleSubmit = async (e) => {
    e.preventDefault();
    
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
  
  // Get position title from ID
  const getPositionTitle = (positionId) => {
    const position = positions.find(pos => pos._id === positionId);
    return position ? position.title : 'Unknown Position';
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  // Get compliance indicator class
  const getComplianceIndicatorClass = (rate) => {
    if (rate >= 90) return 'indicator-excellent';
    if (rate >= 75) return 'indicator-good';
    if (rate >= 50) return 'indicator-warning';
    return 'indicator-danger';
  };
  
  return (
    <div className="certificates-with-dashboard">
      {/* Dashboard Summary */}
      <div className="dashboard-summary">
        <div className="summary-header">
          <h2>Certificate Dashboard</h2>
          <div className="header-actions">
            {isAdmin && (
              <button
                onClick={onViewAdmin}
                className="admin-btn"
              >
                Admin Dashboard
              </button>
            )}
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="metrics-grid">
          <div className="metric-card primary">
            <div className="metric-header">
              <span className="metric-label">Overall Compliance</span>
              <div className={`compliance-indicator ${getComplianceIndicatorClass(dashboardStats.complianceRate)}`}>
                {dashboardStats.complianceRate}%
              </div>
            </div>
            <div className="metric-subtitle">
              {dashboardStats.activeCertificates} of {dashboardStats.totalCertificates} certificates active
            </div>
          </div>
          
          <div className="metric-card">
            <div className="metric-value">{dashboardStats.totalEmployees}</div>
            <div className="metric-label">Active Employees</div>
          </div>
          
          <div className="metric-card warning">
            <div className="metric-value">{dashboardStats.expiringSoon}</div>
            <div className="metric-label">Expiring Soon</div>
            <div className="metric-subtitle">Next 30 days</div>
          </div>
          
          <div className="metric-card danger">
            <div className="metric-value">{dashboardStats.expired}</div>
            <div className="metric-label">Expired</div>
            <div className="metric-subtitle">Need renewal</div>
          </div>
        </div>
        
        {/* Quick Insights */}
        <div className="insights-grid">
          {/* Positions Needing Attention */}
          <div className="insight-card">
            <h3>Positions Needing Attention</h3>
            {complianceByPosition.length === 0 ? (
              <p className="no-data">All positions are compliant</p>
            ) : (
              <div className="position-list">
                {complianceByPosition.map((pos, index) => (
                  <div key={index} className="position-item">
                    <div className="position-info">
                      <div className="position-name">{pos.position}</div>
                      <div className="position-department">{pos.department}</div>
                    </div>
                    <div className="position-stats">
                      <div className={`compliance-rate ${getComplianceIndicatorClass(pos.complianceRate)}`}>
                        {pos.complianceRate}%
                      </div>
                      <div className="employee-count">{pos.employees} employees</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Urgent Actions */}
          <div className="insight-card">
            <h3>Urgent Actions Required</h3>
            {urgentActions.length === 0 ? (
              <p className="no-data">No urgent actions needed</p>
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
                      <div className="expiry-date">{formatDate(action.expiryDate)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Certificate Entry Form */}
      <div className="certificate-form-section">
        <div className="form-header">
          <h3>Add New Certificate</h3>
        </div>
        
        {loading && <div className="loading-indicator">Processing...</div>}
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <form onSubmit={handleSubmit} className="certificate-form">
          <div className="form-row">
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
                {employees
                  .filter(emp => emp.active !== false)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(emp => (
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
                  This employee has no positions assigned
                </div>
              )}
            </div>
          </div>
          
          <div className="form-row">
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
                {certificateTypes
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(cert => (
                    <option key={cert._id} value={cert._id}>
                      {cert.name} ({cert.validityPeriod} months)
                    </option>
                  ))}
              </select>
            </div>
            
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
          </div>
          
          <div className="form-row">
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
                Auto-calculated based on certificate type
              </div>
            </div>
            
            <div className="form-group">
              <div className="form-actions">
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Certificate'}
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
          </div>
        </form>
      </div>
      
      {/* Certificates Table */}
      <div className="certificates-table-section">
        <div className="table-header">
          <h3>Certificate Records</h3>
          
          <div className="filter-controls">
            <div className="filter-group">
              <label>Filter by Employee:</label>
              <select
                value={selectedFilterEmployee}
                onChange={(e) => setSelectedFilterEmployee(e.target.value)}
              >
                <option value="">All Employees</option>
                {[...new Set(certificates.map(cert => cert.staffMember))]
                  .sort()
                  .map(name => {
                    const employee = employees.find(emp => emp.name === name);
                    const isArchived = employee && !employee.active;
                    return (
                      <option key={name} value={name}>
                        {name} {isArchived ? '(Archived)' : ''}
                      </option>
                    );
                  })}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Filter by Type:</label>
              <select
                value={selectedFilterCertType}
                onChange={(e) => setSelectedFilterCertType(e.target.value)}
              >
                <option value="">All Types</option>
                {certificateTypes
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(type => (
                    <option key={type._id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
        
        {selectedFilterEmployee && (
          <div className="employee-actions">
            <button
              className="view-employee-btn"
              onClick={() => onViewEmployee && onViewEmployee(selectedFilterEmployee)}
            >
              View {selectedFilterEmployee}'s Details & Compliance
            </button>
          </div>
        )}
        
        <div className="table-container">
          <table className="certificates-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Certificate Type</th>
                <th>Issue Date</th>
                <th>Expiration Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {certificates
                .filter(cert =>
                  (!selectedFilterEmployee || cert.staffMember === selectedFilterEmployee) &&
                  (!selectedFilterCertType || (cert.certificateName || cert.certificateType) === selectedFilterCertType)
                )
                .sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))
                .map((cert) => {
                  const expirationDate = new Date(cert.expirationDate);
                  const today = new Date();
                  const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));

                  let statusClass = 'status-active';
                  if (daysUntilExpiration <= 0) statusClass = 'status-expired';
                  else if (daysUntilExpiration <= 30) statusClass = 'status-expiring';

                  // Check if employee is archived
                  const employee = employees.find(emp => emp.name === cert.staffMember);
                  const isArchived = employee && !employee.active;

                  return (
                    <tr key={cert._id} className={`${statusClass} ${isArchived ? 'archived-employee' : ''}`}>
                      <td>
                        {cert.staffMember}
                        {isArchived && <span className="archived-badge">Archived</span>}
                      </td>
                      <td>{getPositionTitle(cert.position)}</td>
                      <td>{cert.certificateName || cert.certificateType}</td>
                      <td>{formatDate(cert.issueDate)}</td>
                      <td>{formatDate(cert.expirationDate)}</td>
                      <td>
                        <span className={`status-badge ${statusClass.replace('status-', '')}`}>
                          {cert.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      
      <style jsx>{`
        .certificates-with-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
          min-height: 100vh;
        }
        
        /* Dashboard Summary Styles */
        .dashboard-summary {
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .summary-header h2 {
          color: #2d3748;
          margin: 0;
          font-size: 1.75rem;
          font-weight: 600;
        }
        
        .admin-btn {
          background-color: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .admin-btn:hover {
          background-color: #b91c1c;
        }
        
        /* Metrics Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .metric-card {
          background-color: #f7fafc;
          border-radius: 8px;
          padding: 20px;
          border: 1px solid #e2e8f0;
        }
        
        .metric-card.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
        }
        
        .metric-card.warning {
          border-color: #f6ad55;
          background-color: #fffbeb;
        }
        
        .metric-card.danger {
          border-color: #f56565;
          background-color: #fff5f5;
        }
        
        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .metric-label {
          font-weight: 500;
          color: #4a5568;
          font-size: 0.9rem;
        }
        
        .metric-card.primary .metric-label {
          color: rgba(255, 255, 255, 0.9);
        }
        
        .compliance-indicator {
          font-size: 1.5rem;
          font-weight: 700;
          padding: 5px 10px;
          border-radius: 6px;
          background-color: rgba(255, 255, 255, 0.2);
        }
        
        .metric-value {
          font-size: 2rem;
          font-weight: 700;
          color: #2c5282;
          margin-bottom: 5px;
        }
        
        .metric-card.warning .metric-value {
          color: #c05621;
        }
        
        .metric-card.danger .metric-value {
          color: #c53030;
        }
        
        .metric-subtitle {
          font-size: 0.8rem;
          color: #718096;
        }
        
        .metric-card.primary .metric-subtitle {
          color: rgba(255, 255, 255, 0.8);
        }
        
        /* Insights Grid */
        .insights-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        
        .insight-card {
          background-color: #f7fafc;
          border-radius: 8px;
          padding: 20px;
          border: 1px solid #e2e8f0;
        }
        
        .insight-card h3 {
          color: #2d3748;
          margin: 0 0 15px 0;
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .no-data {
          color: #a0aec0;
          font-style: italic;
          text-align: center;
          padding: 20px 0;
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
          padding: 12px;
          background-color: white;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        
        .position-info, .action-info {
          flex: 1;
        }
        
        .position-name, .employee-name {
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 2px;
        }
        
        .position-department, .certificate-name {
          font-size: 0.9rem;
          color: #718096;
        }
        
        .position-stats, .action-urgency {
          text-align: right;
        }
        
        .compliance-rate {
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 2px;
        }
        
        .indicator-excellent { color: #10b981; }
        .indicator-good { color: #68d391; }
        .indicator-warning { color: #f6ad55; }
        .indicator-danger { color: #f56565; }
        
        .employee-count {
          font-size: 0.8rem;
          color: #718096;
        }
        
        .days-left {
          font-weight: 700;
          font-size: 1.1rem;
          margin-bottom: 2px;
        }
        
        .days-left.critical {
          color: #c53030;
        }
        
        .days-left.warning {
          color: #c05621;
        }
        
        .expiry-date {
          font-size: 0.8rem;
          color: #718096;
        }
        
        /* Certificate Form Section */
        .certificate-form-section {
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 30px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .form-header h3 {
          color: #2d3748;
          margin: 0 0 20px 0;
          font-size: 1.25rem;
          font-weight: 600;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .certificate-form {
          background-color: #f7fafc;
          padding: 20px;
          border-radius: 6px;
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
          font-weight: 500;
          color: #4a5568;
          margin-bottom: 5px;
        }
        
        .form-group input,
        .form-group select {
          padding: 10px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.95rem;
          background-color: white;
        }
        
        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }
        
        .readonly-input {
          background-color: #edf2f7 !important;
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
          justify-content: flex-start;
          align-items: center;
          height: 100%;
          padding-top: 25px;
        }
        
        .submit-btn {
          background-color: #4299e1;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .submit-btn:hover:not(:disabled) {
          background-color: #3182ce;
        }
        
        .submit-btn:disabled {
          background-color: #a0aec0;
          cursor: not-allowed;
        }
        
        .reset-btn {
          background-color: #e2e8f0;
          color: #4a5568;
          border: none;
          border-radius: 4px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .reset-btn:hover:not(:disabled) {
          background-color: #cbd5e0;
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
        
        /* Certificates Table Section */
        .certificates-table-section {
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .table-header h3 {
          color: #2d3748;
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .filter-controls {
          display: flex;
          gap: 15px;
          align-items: center;
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
          font-size: 0.9rem;
        }
        
        .filter-group select {
          padding: 6px 10px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.9rem;
          min-width: 180px;
          background-color: white;
        }
        
        .employee-actions {
          margin-bottom: 20px;
        }
        
        .view-employee-btn {
          background-color: #805ad5;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 12px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .view-employee-btn:hover {
          background-color: #6b46c1;
        }
        
        .table-container {
          overflow-x: auto;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        
        .certificates-table {
          width: 100%;
          border-collapse: collapse;
          background-color: white;
        }
        
        .certificates-table th {
          text-align: left;
          padding: 12px 15px;
          background-color: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-bottom: 2px solid #cbd5e0;
          font-size: 0.9rem;
        }
        
        .certificates-table td {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.9rem;
        }
        
        .certificates-table tr:hover {
          background-color: #f7fafc;
        }
        
        .certificates-table tr.status-active {
          background-color: #f0fff4;
        }
        
        .certificates-table tr.status-expiring {
          background-color: #fffbeb;
        }
        
        .certificates-table tr.status-expired {
          background-color: #fff5f5;
        }
        
        .certificates-table tr.archived-employee {
          opacity: 0.7;
          background-color: #faf5ff;
        }
        
        .archived-badge {
          background-color: #fbbf24;
          color: #92400e;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          margin-left: 8px;
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
        
        .status-badge.expiring {
          background-color: #feebc8;
          color: #c05621;
        }
        
        .status-badge.expired {
          background-color: #fed7d7;
          color: #c53030;
        }
        
        /* Responsive Design */
        @media (max-width: 1024px) {
          .metrics-grid {
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          
          .insights-grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .certificates-with-dashboard {
            padding: 15px;
          }
          
          .summary-header {
            flex-direction: column;
            gap: 15px;
            align-items: flex-start;
          }
          
          .metrics-grid {
            grid-template-columns: 1fr;
          }
          
          .form-row {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          
          .table-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .filter-controls {
            width: 100%;
            justify-content: flex-start;
          }
          
          .filter-group {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }
          
          .filter-group select {
            min-width: 200px;
          }
          
          .certificates-table {
            font-size: 0.8rem;
          }
          
          .certificates-table th,
          .certificates-table td {
            padding: 8px 10px;
          }
          
          /* Hide less important columns on mobile */
          .certificates-table th:nth-child(2),
          .certificates-table td:nth-child(2),
          .certificates-table th:nth-child(4),
          .certificates-table td:nth-child(4) {
            display: none;
          }
        }
        
        @media (max-width: 640px) {
          .position-item, .action-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          
          .position-stats, .action-urgency {
            text-align: left;
            width: 100%;
          }
        }

// import { useState, useEffect } from 'react';

// const CertificateForm = ({
//   token,
//   employees = [],
//   positions = [],
//   certificateTypes = [],
//   onCertificateAdded,
//   onCancel
// }) => {
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [success, setSuccess] = useState('');
  
//   // Form state
//   const [formData, setFormData] = useState({
//     staffMember: '',
//     position: '',
//     certificateType: '',
//     issueDate: new Date().toISOString().split('T')[0],
//     expirationDate: ''
//   });
  
//   // Selected employee's positions
//   const [employeePositions, setEmployeePositions] = useState([]);
  
//   // Update employee positions when employee changes
//   useEffect(() => {
//     if (formData.staffMember) {
//       const selectedEmployee = employees.find(emp => emp._id === formData.staffMember);
//       if (selectedEmployee && selectedEmployee.positions) {
//         // Get full position objects
//         const positionObjects = selectedEmployee.positions.map(posId => {
//           const posObj = positions.find(p => p._id === (typeof posId === 'object' ? posId._id : posId));
//           return posObj || null;
//         }).filter(Boolean);
        
//         setEmployeePositions(positionObjects);
        
//         // Set default position to primary position if available
//         if (selectedEmployee.primaryPosition && !formData.position) {
//           const primaryPosId = typeof selectedEmployee.primaryPosition === 'object' 
//             ? selectedEmployee.primaryPosition._id 
//             : selectedEmployee.primaryPosition;
            
//           setFormData(prev => ({
//             ...prev,
//             position: primaryPosId
//           }));
//         }
//       } else {
//         setEmployeePositions([]);
//       }
//     } else {
//       setEmployeePositions([]);
//     }
//   }, [formData.staffMember, employees, positions]);
  
//   // Calculate expiration date when certificate type or issue date changes
//   useEffect(() => {
//     if (formData.certificateType && formData.issueDate) {
//       const selectedCertType = certificateTypes.find(
//         cert => cert._id === formData.certificateType
//       );
      
//       if (selectedCertType) {
//         const issueDate = new Date(formData.issueDate);
//         const expiryDate = new Date(issueDate);
//         expiryDate.setMonth(expiryDate.getMonth() + selectedCertType.validityPeriod);
        
//         setFormData(prev => ({
//           ...prev,
//           expirationDate: expiryDate.toISOString().split('T')[0]
//         }));
//       }
//     }
//   }, [formData.certificateType, formData.issueDate, certificateTypes]);
  
//   // Handle form input changes
//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({
//       ...prev,
//       [name]: value
//     }));
    
//     // Reset position when employee changes
//     if (name === 'staffMember') {
//       setFormData(prev => ({
//         ...prev,
//         position: ''
//       }));
//     }
//   };
  
//   // Reset form to defaults
//   const resetForm = () => {
//     setFormData({
//       staffMember: '',
//       position: '',
//       certificateType: '',
//       issueDate: new Date().toISOString().split('T')[0],
//       expirationDate: ''
//     });
//     setError('');
//     setSuccess('');
//   };
  
//   // Submit form
//   const handleSubmit = async () => {
//     // Validate form
//     if (!formData.staffMember || !formData.position || !formData.certificateType || !formData.issueDate) {
//       setError('Please fill in all required fields');
//       return;
//     }
    
//     setLoading(true);
//     setError('');
//     setSuccess('');
    
//     try {
//       // Get employee name from ID
//       const employee = employees.find(emp => emp._id === formData.staffMember);
//       if (!employee) {
//         throw new Error('Employee not found');
//       }
      
//       // Get certificate type name from ID
//       const certType = certificateTypes.find(cert => cert._id === formData.certificateType);
//       if (!certType) {
//         throw new Error('Certificate type not found');
//       }
      
//       // Prepare data for API
//       const certificateData = {
//         staffMember: employee.name,
//         position: formData.position,
//         certificateType: certType.name,
//         issueDate: formData.issueDate,
//         expirationDate: formData.expirationDate
//       };
      
//       // Submit to API
//       const response = await fetch('https://training-cert-tracker.onrender.com/api/certificates/upload', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(certificateData),
//       });
      
//       if (!response.ok) {
//         const result = await response.json();
//         throw new Error(result.message || 'Failed to add certificate');
//       }
      
//       const result = await response.json();
      
//       setSuccess('Certificate added successfully!');
//       resetForm();
      
//       // Notify parent component
//       if (onCertificateAdded) {
//         onCertificateAdded(result);
//       }
//     } catch (err) {
//       setError(err.message || 'Error adding certificate');
//     } finally {
//       setLoading(false);
//     }
//   };
  
//   return (
//     <div className="certificate-form-container">
//       <h3>Add New Certificate</h3>
      
//       {loading && <div className="loading-indicator">Processing...</div>}
//       {error && <div className="error-message">{error}</div>}
//       {success && <div className="success-message">{success}</div>}
      
//       <div className="form-content">
//         <div className="form-group">
//           <label htmlFor="staffMember">Employee:</label>
//           <select
//             id="staffMember"
//             name="staffMember"
//             value={formData.staffMember}
//             onChange={handleInputChange}
//             required
//           >
//             <option value="">-- Select Employee --</option>
//             {employees.map(emp => (
//               <option key={emp._id} value={emp._id}>
//                 {emp.name}
//               </option>
//             ))}
//           </select>
//         </div>
        
//         <div className="form-group">
//           <label htmlFor="position">Position:</label>
//           <select
//             id="position"
//             name="position"
//             value={formData.position}
//             onChange={handleInputChange}
//             required
//             disabled={!formData.staffMember || employeePositions.length === 0}
//           >
//             <option value="">-- Select Position --</option>
//             {employeePositions.map(pos => {
//               const isPrimary = employees.find(emp => emp._id === formData.staffMember)?.primaryPosition === pos._id;
//               return (
//                 <option key={pos._id} value={pos._id}>
//                   {pos.title} {isPrimary ? '(Primary)' : ''}
//                 </option>
//               );
//             })}
//           </select>
//           {formData.staffMember && employeePositions.length === 0 && (
//             <div className="helper-text warning">
//               This employee has no positions assigned. Please add a position first.
//             </div>
//           )}
//         </div>
        
//         <div className="form-group">
//           <label htmlFor="certificateType">Certificate Type:</label>
//           <select
//             id="certificateType"
//             name="certificateType"
//             value={formData.certificateType}
//             onChange={handleInputChange}
//             required
//           >
//             <option value="">-- Select Certificate Type --</option>
//             {certificateTypes.map(cert => (
//               <option key={cert._id} value={cert._id}>
//                 {cert.name} ({cert.validityPeriod} months validity)
//               </option>
//             ))}
//           </select>
//         </div>
        
//         <div className="form-row">
//           <div className="form-group">
//             <label htmlFor="issueDate">Issue Date:</label>
//             <input
//               type="date"
//               id="issueDate"
//               name="issueDate"
//               value={formData.issueDate}
//               onChange={handleInputChange}
//               required
//             />
//           </div>
          
//           <div className="form-group">
//             <label htmlFor="expirationDate">Expiration Date:</label>
//             <input
//               type="date"
//               id="expirationDate"
//               name="expirationDate"
//               value={formData.expirationDate}
//               readOnly
//               className="readonly-input"
//             />
//             <div className="helper-text">
//               Calculated based on certificate type
//             </div>
//           </div>
//         </div>
        
//         <div className="form-actions">
//           <button
//             type="button"
//             className="submit-btn"
//             onClick={handleSubmit}
//             disabled={loading}
//           >
//             {loading ? 'Adding...' : 'Add Certificate'}
//           </button>
//           <button
//             type="button"
//             className="cancel-btn"
//             onClick={onCancel || resetForm}
//             disabled={loading}
//           >
//             {onCancel ? 'Cancel' : 'Reset'}
//           </button>
//         </div>
//       </div>
      
//       <style jsx>{`
//         .certificate-form-container {
//           background-color: white;
//           border-radius: 8px;
//           padding: 20px;
//           box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
//           max-width: 700px;
//           margin: 0 auto;
//         }
        
//         h3 {
//           color: #2d3748;
//           margin-top: 0;
//           margin-bottom: 20px;
//           padding-bottom: 10px;
//           border-bottom: 1px solid #e2e8f0;
//         }
        
//         .form-content {
//           background-color: #f8fafc;
//           padding: 20px;
//           border-radius: 6px;
//         }
        
//         .form-group {
//           margin-bottom: 20px;
//         }
        
//         .form-row {
//           display: grid;
//           grid-template-columns: 1fr 1fr;
//           gap: 20px;
//         }
        
//         label {
//           display: block;
//           margin-bottom: 5px;
//           font-weight: 500;
//           color: #4a5568;
//         }
        
//         input,
//         select {
//           width: 100%;
//           padding: 10px;
//           border: 1px solid #cbd5e0;
//           border-radius: 4px;
//           font-size: 0.95rem;
//         }
        
//         .readonly-input {
//           background-color: #edf2f7;
//           color: #718096;
//         }
        
//         .helper-text {
//           margin-top: 5px;
//           font-size: 0.8rem;
//           color: #718096;
//         }
        
//         .helper-text.warning {
//           color: #dd6b20;
//         }
        
//         .form-actions {
//           display: flex;
//           gap: 10px;
//           margin-top: 20px;
//         }
        
//         .submit-btn {
//           flex: 1;
//           background-color: #4299e1;
//           color: white;
//           border: none;
//           border-radius: 4px;
//           padding: 12px 16px;
//           font-weight: 500;
//           cursor: pointer;
//           transition: background-color 0.2s;
//         }
        
//         .submit-btn:hover:not(:disabled) {
//           background-color: #3182ce;
//         }
        
//         .cancel-btn {
//           flex: 1;
//           background-color: #e2e8f0;
//           color: #4a5568;
//           border: none;
//           border-radius: 4px;
//           padding: 12px 16px;
//           font-weight: 500;
//           cursor: pointer;
//           transition: background-color 0.2s;
//         }
        
//         .cancel-btn:hover:not(:disabled) {
//           background-color: #cbd5e0;
//         }
        
//         button:disabled {
//           opacity: 0.7;
//           cursor: not-allowed;
//         }
        
//         .loading-indicator {
//           padding: 10px;
//           text-align: center;
//           color: #4299e1;
//           margin-bottom: 15px;
//         }
        
//         .error-message {
//           padding: 10px;
//           background-color: #fff5f5;
//           color: #c53030;
//           border-radius: 4px;
//           margin-bottom: 15px;
//         }
        
//         .success-message {
//           padding: 10px;
//           background-color: #f0fff4;
//           color: #2f855a;
//           border-radius: 4px;
//           margin-bottom: 15px;
//         }
        
//         @media (max-width: 640px) {
//           .form-row {
//             grid-template-columns: 1fr;
//             gap: 0;
//           }
//         }
//       `}</style>
//     </div>
//   );
// };

// export default CertificateForm;
