import { useState, useEffect } from 'react';

const MultiPositionComplianceDashboard = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [requirements, setRequirements] = useState([]);
  
  // Compliance data by position and employee
  const [complianceData, setComplianceData] = useState([]);
  
  // Stats by position
  const [positionStats, setPositionStats] = useState([]);
  
  // Overall compliance stats
  const [overallStats, setOverallStats] = useState({
    totalRequirements: 0,
    compliantRequirements: 0,
    expiringRequirements: 0,
    expiredRequirements: 0,
    complianceRate: 0
  });
  
  // Filters
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [token]);
  
  // Process data when all data is loaded
  useEffect(() => {
    if (!loading && employees.length > 0 && positions.length > 0 && certificates.length > 0) {
      processComplianceData();
    }
  }, [loading, employees, positions, certificates, requirements]);
  
  // Fetch all necessary data
  const fetchData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch setup data
      const setupResponse = await fetch('https://training-cert-tracker.onrender.com/api/setup', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!setupResponse.ok) {
        throw new Error('Failed to fetch setup data');
      }
      
      const setupData = await setupResponse.json();
      setEmployees(setupData.employees || []);
      setPositions(setupData.positions || []);
      
      // Fetch certificates
      const certResponse = await fetch('https://training-cert-tracker.onrender.com/api/certificates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!certResponse.ok) {
        throw new Error('Failed to fetch certificates');
      }
      
      const certificatesData = await certResponse.json();
      setCertificates(certificatesData || []);
      
      // Fetch position requirements
      const reqResponse = await fetch('https://training-cert-tracker.onrender.com/api/positionRequirements', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!reqResponse.ok) {
        throw new Error('Failed to fetch position requirements');
      }
      
      const requirementsData = await reqResponse.json();
      setRequirements(requirementsData || []);
      
    } catch (err) {
      setError(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };
  
  // Process compliance data
  const processComplianceData = () => {
    // Process each employee and their positions
    const employeeCompliance = [];
    
    for (const employee of employees) {
      // Get employee positions
      const employeePositions = employee.positions || [];
      
      // For each position, check compliance with requirements
      for (const positionId of employeePositions) {
        const posObj = positions.find(p => p._id === (typeof positionId === 'object' ? positionId._id : positionId));
        
        if (!posObj) continue;
        
        // Get requirements for this position
        const positionRequirements = requirements.filter(req => 
          (typeof req.position === 'object' ? req.position._id : req.position) === posObj._id
        );
        
        // If no requirements, skip
        if (positionRequirements.length === 0) continue;
        
        // Get certificates for this employee and position
        const employeeCertificates = certificates.filter(cert => 
          cert.staffMember === employee.name && 
          (cert.position === posObj._id || cert.position === posObj._id.toString())
        );
        
        // Check compliance for each requirement
        const requirementsStatus = positionRequirements.map(req => {
          // Find matching certificate
          const matchingCert = employeeCertificates.find(cert => 
            cert.certificateType === req.certificateType
          );
          
          // Determine status
          let status = 'missing';
          if (matchingCert) {
            if (matchingCert.status === 'Active') {
              status = 'compliant';
            } else if (matchingCert.status === 'Expiring Soon') {
              status = 'expiring';
            } else if (matchingCert.status === 'Expired') {
              status = 'expired';
            }
          }
          
          return {
            requirementId: req._id,
            certificateType: req.certificateType,
            isRequired: req.isRequired,
            status,
            certificate: matchingCert || null
          };
        });
        
        // Calculate compliance
        const requiredReqs = requirementsStatus.filter(req => req.isRequired);
        const compliantReqs = requiredReqs.filter(req => req.status === 'compliant');
        const expiringReqs = requiredReqs.filter(req => req.status === 'expiring');
        const expiredReqs = requiredReqs.filter(req => req.status === 'expired');
        const missingReqs = requiredReqs.filter(req => req.status === 'missing');
        
        const complianceRate = requiredReqs.length > 0 
          ? Math.round((compliantReqs.length / requiredReqs.length) * 100) 
          : 100;
        
        employeeCompliance.push({
          employeeId: employee._id,
          employeeName: employee.name,
          positionId: posObj._id,
          positionTitle: posObj.title,
          department: posObj.department || 'No Department',
          isPrimary: employee.primaryPosition && 
            ((typeof employee.primaryPosition === 'object' && employee.primaryPosition._id === posObj._id) || 
             (typeof employee.primaryPosition === 'string' && employee.primaryPosition === posObj._id)),
          requirements: requirementsStatus,
          stats: {
            totalRequirements: requiredReqs.length,
            compliantRequirements: compliantReqs.length,
            expiringRequirements: expiringReqs.length,
            expiredRequirements: expiredReqs.length,
            missingRequirements: missingReqs.length,
            complianceRate
          }
        });
      }
    }
    
    // Set employee compliance data
    setComplianceData(employeeCompliance);
    
    // Calculate position stats
    const posStats = [];
    
    for (const position of positions) {
      const positionData = employeeCompliance.filter(comp => comp.positionId === position._id);
      
      if (positionData.length === 0) continue;
      
      // Calculate averages
      const totalEmployees = positionData.length;
      const totalRequirements = positionData.reduce((sum, comp) => sum + comp.stats.totalRequirements, 0);
      const compliantRequirements = positionData.reduce((sum, comp) => sum + comp.stats.compliantRequirements, 0);
      const expiringRequirements = positionData.reduce((sum, comp) => sum + comp.stats.expiringRequirements, 0);
      const expiredRequirements = positionData.reduce((sum, comp) => sum + comp.stats.expiredRequirements, 0);
      
      const complianceRate = totalRequirements > 0 
        ? Math.round((compliantRequirements / totalRequirements) * 100) 
        : 100;
      
      posStats.push({
        positionId: position._id,
        positionTitle: position.title,
        department: position.department || 'No Department',
        employeeCount: totalEmployees,
        stats: {
          totalRequirements,
          compliantRequirements,
          expiringRequirements,
          expiredRequirements,
          complianceRate
        }
      });
    }
    
    // Sort by compliance rate (ascending)
    posStats.sort((a, b) => a.stats.complianceRate - b.stats.complianceRate);
    
    setPositionStats(posStats);
    
    // Calculate overall stats
    const totalRequirements = posStats.reduce((sum, pos) => sum + pos.stats.totalRequirements, 0);
    const compliantRequirements = posStats.reduce((sum, pos) => sum + pos.stats.compliantRequirements, 0);
    const expiringRequirements = posStats.reduce((sum, pos) => sum + pos.stats.expiringRequirements, 0);
    const expiredRequirements = posStats.reduce((sum, pos) => sum + pos.stats.expiredRequirements, 0);
    
    const overallComplianceRate = totalRequirements > 0 
      ? Math.round((compliantRequirements / totalRequirements) * 100) 
      : 100;
    
    setOverallStats({
      totalRequirements,
      compliantRequirements,
      expiringRequirements,
      expiredRequirements,
      complianceRate: overallComplianceRate
    });
  };
  
  // Get all departments from positions
  const departments = ['all', ...new Set(positions
    .map(pos => pos.department || 'No Department')
    .filter(Boolean)
  )];
  
  // Filter compliance data
  const filteredData = complianceData.filter(data => {
    // Filter by department
    if (departmentFilter !== 'all' && data.department !== departmentFilter) {
      return false;
    }
    
    // Filter by status
    if (statusFilter === 'compliant' && data.stats.complianceRate !== 100) {
      return false;
    } else if (statusFilter === 'non-compliant' && data.stats.complianceRate === 100) {
      return false;
    } else if (statusFilter === 'expiring' && data.stats.expiringRequirements === 0) {
      return false;
    } else if (statusFilter === 'expired' && data.stats.expiredRequirements === 0) {
      return false;
    }
    
    return true;
  });
  
  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'compliant': return 'status-badge-success';
      case 'expiring': return 'status-badge-warning';
      case 'expired': return 'status-badge-danger';
      case 'missing': return 'status-badge-error';
      default: return '';
    }
  };
  
  // Format requirement status
  const formatRequirementStatus = (status) => {
    switch (status) {
      case 'compliant': return 'Compliant';
      case 'expiring': return 'Expiring Soon';
      case 'expired': return 'Expired';
      case 'missing': return 'Missing';
      default: return status;
    }
  };
  
  // Get compliance indicator class
  const getComplianceIndicatorClass = (rate) => {
    if (rate === 100) return 'indicator-success';
    if (rate >= 75) return 'indicator-good';
    if (rate >= 50) return 'indicator-warning';
    return 'indicator-danger';
  };
  
  return (
    <div className="multi-position-compliance-dashboard">
      <h2>Certification Compliance Dashboard</h2>
      
      {loading ? (
        <div className="loading-indicator">Loading compliance data...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          {/* Overall Stats */}
          <div className="overall-stats">
            <div className="compliance-indicator">
              <div className="chart-container">
                <div className="compliance-chart">
                  <div 
                    className={`chart-fill ${getComplianceIndicatorClass(overallStats.complianceRate)}`}
                    style={{ width: `${overallStats.complianceRate}%` }}
                  ></div>
                </div>
                <div className="chart-text">
                  <div className="chart-value">{overallStats.complianceRate}%</div>
                  <div className="chart-label">Overall Compliance</div>
                </div>
              </div>
            </div>
            
            <div className="stat-summary">
              <div className="stat-item">
                <div className="stat-label">Total Requirements</div>
                <div className="stat-value">{overallStats.totalRequirements}</div>
              </div>
              <div className="stat-item compliant">
                <div className="stat-label">Compliant</div>
                <div className="stat-value">{overallStats.compliantRequirements}</div>
              </div>
              <div className="stat-item expiring">
                <div className="stat-label">Expiring Soon</div>
                <div className="stat-value">{overallStats.expiringRequirements}</div>
              </div>
              <div className="stat-item expired">
                <div className="stat-label">Expired</div>
                <div className="stat-value">{overallStats.expiredRequirements}</div>
              </div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="filter-controls">
            <div className="filter-group">
              <label>Department:</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.filter(dept => dept !== 'all').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="compliant">Fully Compliant</option>
                <option value="non-compliant">Non-Compliant</option>
                <option value="expiring">Has Expiring</option>
                <option value="expired">Has Expired</option>
              </select>
            </div>
          </div>
          
          {/* Position Stats */}
          <div className="position-stats">
            <h3>Compliance by Position</h3>
            <div className="table-container">
              <table className="position-stats-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Department</th>
                    <th>Employees</th>
                    <th>Compliance</th>
                    <th>Total</th>
                    <th>Compliant</th>
                    <th>Expiring</th>
                    <th>Expired</th>
                  </tr>
                </thead>
                <tbody>
                  {positionStats.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="no-results">No position data available</td>
                    </tr>
                  ) : (
                    positionStats
                      .filter(pos => departmentFilter === 'all' || pos.department === departmentFilter)
                      .map(position => (
                        <tr key={position.positionId}>
                          <td>{position.positionTitle}</td>
                          <td>{position.department}</td>
                          <td>{position.employeeCount}</td>
                          <td>
                            <div className="compliance-bar-container">
                              <div 
                                className={`compliance-bar ${getComplianceIndicatorClass(position.stats.complianceRate)}`}
                                style={{ width: `${position.stats.complianceRate}%` }}
                              ></div>
                              <span className="compliance-text">{position.stats.complianceRate}%</span>
                            </div>
                          </td>
                          <td>{position.stats.totalRequirements}</td>
                          <td className="compliant">{position.stats.compliantRequirements}</td>
                          <td className="expiring">{position.stats.expiringRequirements}</td>
                          <td className="expired">{position.stats.expiredRequirements}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Detailed Employee Compliance */}
          <div className="employee-compliance">
            <h3>Employee Certification Compliance</h3>
            
            {filteredData.length === 0 ? (
              <div className="no-results">No compliance data matching the selected filters</div>
            ) : (
              <div className="compliance-cards">
                {filteredData.map((data, index) => (
                  <div key={`${data.employeeId}-${data.positionId}`} className="compliance-card">
                    <div className="card-header">
                      <div className="header-main">
                        <div className="employee-name">{data.employeeName}</div>
                        <div className="position-info">
                          <span className="position-title">
                            {data.positionTitle}
                          </span>
                          {data.isPrimary && (
                            <span className="primary-badge">Primary</span>
                          )}
                        </div>
                      </div>
                      <div className="department-badge">{data.department}</div>
                    </div>
                    
                    <div className="compliance-summary">
                      <div className="compliance-rate">
                        <div 
                          className={`rate-indicator ${getComplianceIndicatorClass(data.stats.complianceRate)}`}
                        >
                          {data.stats.complianceRate}%
                        </div>
                        <div className="rate-label">Compliance</div>
                      </div>
                      
                      <div className="requirement-counts">
                        <div className="count-item">
                          <div className="count-value total">{data.stats.totalRequirements}</div>
                          <div className="count-label">Total</div>
                        </div>
                        <div className="count-item">
                          <div className="count-value compliant">{data.stats.compliantRequirements}</div>
                          <div className="count-label">Compliant</div>
                        </div>
                        <div className="count-item">
                          <div className="count-value expiring">{data.stats.expiringRequirements}</div>
                          <div className="count-label">Expiring</div>
                        </div>
                        <div className="count-item">
                          <div className="count-value expired">{data.stats.expiredRequirements}</div>
                          <div className="count-label">Expired</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="requirements-list">
                      {data.requirements.map((req, reqIndex) => (
                        <div key={reqIndex} className="requirement-item">
                          <div className="req-main">
                            <div className="req-title">
                              {req.certificateType}
                              {!req.isRequired && (
                                <span className="optional-badge">Optional</span>
                              )}
                            </div>
                            <div className={`req-status ${getStatusBadgeClass(req.status)}`}>
                              {formatRequirementStatus(req.status)}
                            </div>
                          </div>
                          
                          {req.certificate && (
                            <div className="certificate-info">
                              <div className="cert-dates">
                                <span className="cert-date">
                                  <strong>Issued:</strong> {formatDate(req.certificate.issueDate)}
                                </span>
                                <span className="cert-date">
                                  <strong>Expires:</strong> {formatDate(req.certificate.expirationDate)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      
      <style jsx>{`
        .multi-position-compliance-dashboard {
          padding: 20px;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
          color: #2d3748;
          margin-top: 0;
          margin-bottom: 20px;
        }
        
        h3 {
          color: #2d3748;
          margin-top: 30px;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .loading-indicator {
          text-align: center;
          padding: 20px;
          color: #4299e1;
          font-weight: 500;
        }
        
        .error-message {
          padding: 15px;
          background-color: #fff5f5;
          color: #c53030;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .no-results {
          text-align: center;
          padding: 30px;
          color: #a0aec0;
          font-style: italic;
          background-color: #f7fafc;
          border-radius: 6px;
        }
        
        /* Overall Stats */
        .overall-stats {
          display: flex;
          background-color: #f7fafc;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .compliance-indicator {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 20px;
        }
        
        .chart-container {
          position: relative;
          width: 200px;
          height: 100px;
        }
        
        .compliance-chart {
          position: absolute;
          width: 100%;
          height: 30px;
          background-color: #e2e8f0;
          border-radius: 15px;
          overflow: hidden;
        }
        
        .chart-fill {
          height: 100%;
          border-radius: 15px;
          transition: width 0.5s ease;
        }
        
        .chart-fill.indicator-success {
          background-color: #48bb78;
        }
        
        .chart-fill.indicator-good {
          background-color: #68d391;
        }
        
        .chart-fill.indicator-warning {
          background-color: #f6ad55;
        }
        
        .chart-fill.indicator-danger {
          background-color: #f56565;
        }
        
        .chart-text {
          position: absolute;
          top: 40px;
          width: 100%;
          text-align: center;
        }
        
        .chart-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #2c5282;
        }
        
        .chart-label {
          font-size: 0.9rem;
          color: #4a5568;
        }
        
        .stat-summary {
          flex: 2;
          display: flex;
          gap: 20px;
        }
        
        .stat-item {
          flex: 1;
          border-left: 1px solid #e2e8f0;
          padding-left: 20px;
        }
        
        .stat-label {
          font-size: 0.9rem;
          color: #4a5568;
          margin-bottom: 5px;
        }
        
        .stat-value {
          font-size: 1.8rem;
          font-weight: 700;
          color: #2c5282;
        }
        
        .stat-item.compliant .stat-value {
          color: #48bb78;
        }
        
        .stat-item.expiring .stat-value {
          color: #f6ad55;
        }
        
        .stat-item.expired .stat-value {
          color: #f56565;
        }
        
        /* Filters */
        .filter-controls {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          background-color: #f7fafc;
          padding: 15px;
          border-radius: 6px;
        }
        
        .filter-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .filter-group label {
          font-weight: 500;
          color: #4a5568;
        }
        
        .filter-group select {
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.9rem;
          min-width: 200px;
        }
        
        /* Position Stats Table */
        .table-container {
          overflow-x: auto;
        }
        
        .position-stats-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .position-stats-table th {
          text-align: left;
          padding: 12px 15px;
          background-color: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-bottom: 2px solid #cbd5e0;
        }
        
        .position-stats-table td {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .position-stats-table tr:hover {
          background-color: #f7fafc;
        }
        
        .compliance-bar-container {
          position: relative;
          width: 100%;
          height: 20px;
          background-color: #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }
        
        .compliance-bar {
          height: 100%;
          border-radius: 10px;
        }
        
        .compliance-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-weight: 600;
          color: #2d3748;
        }
        
        .compliant {
          color: #48bb78;
          font-weight: 600;
        }
        
        .expiring {
          color: #f6ad55;
          font-weight: 600;
        }
        
        .expired {
          color: #f56565;
          font-weight: 600;
        }
        
        /* Employee Compliance Cards */
        .compliance-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .compliance-card {
          background-color: #f8fafc;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .card-header {
          background-color: #edf2f7;
          padding: 15px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        
        .header-main {
          flex: 1;
        }
        
        .employee-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 5px;
        }
        
        .position-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .position-title {
          color: #4a5568;
        }
        
        .primary-badge {
          background-color: #4299e1;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
        }
        
        .department-badge {
          background-color: #e2e8f0;
          color: #4a5568;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
        }
        
        .compliance-summary {
          padding: 15px;
          display: flex;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .compliance-rate {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-right: 1px solid #e2e8f0;
          padding-right: 15px;
        }
        
        .rate-indicator {
          font-size: 1.8rem;
          font-weight: 700;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 5px;
        }
        
        .rate-indicator.indicator-success {
          background-color: #c6f6d5;
          color: #276749;
        }
        
        .rate-indicator.indicator-good {
          background-color: #d6f1dd;
          color: #2b825f;
        }
        
        .rate-indicator.indicator-warning {
          background-color: #feebc8;
          color: #9c4221;
        }
        
        .rate-indicator.indicator-danger {
          background-color: #fed7d7;
          color: #c53030;
        }
        
        .rate-label {
          font-size: 0.8rem;
          color: #4a5568;
        }
        
        .requirement-counts {
          flex: 2;
          display: flex;
          align-items: center;
          justify-content: space-around;
        }
        
        .count-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .count-value {
          font-size: 1.2rem;
          font-weight: 600;
          color: #2d3748;
        }
        
        .count-value.total {
          color: #4a5568;
        }
        
        .count-value.compliant {
          color: #48bb78;
        }
        
        .count-value.expiring {
          color: #f6ad55;
        }
        
        .count-value.expired {
          color: #f56565;
        }
        
        .count-label {
          font-size: 0.7rem;
          color: #718096;
        }
        
        .requirements-list {
          padding: 15px;
        }
        
        .requirement-item {
          padding: 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .requirement-item:last-child {
          border-bottom: none;
        }
        
        .req-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }
        
        .req-title {
          font-weight: 500;
          color: #2d3748;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .optional-badge {
          background-color: #e2e8f0;
          color: #718096;
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: normal;
        }
        
        .req-status {
          font-size: 0.8rem;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 4px;
        }
        
        .status-badge-success {
          background-color: #c6f6d5;
          color: #276749;
        }
        
        .status-badge-warning {
          background-color: #feebc8;
          color: #9c4221;
        }
        
        .status-badge-danger {
          background-color: #fed7d7;
          color: #c53030;
        }
        
        .status-badge-error {
          background-color: #e2e8f0;
          color: #4a5568;
        }
        
        .certificate-info {
          font-size: 0.85rem;
          color: #718096;
          padding-left: 5px;
        }
        
        .cert-dates {
          display: flex;
          gap: 15px;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .overall-stats {
            flex-direction: column;
          }
          
          .compliance-indicator {
            margin-right: 0;
            margin-bottom: 20px;
          }
          
          .stat-summary {
            flex-wrap: wrap;
          }
          
          .stat-item {
            flex: 1 0 40%;
            border-left: none;
            padding-left: 0;
            margin-bottom: 10px;
          }
          
          .filter-controls {
            flex-direction: column;
            gap: 10px;
          }
          
          .filter-group {
            width: 100%;
          }
          
          .filter-group select {
            width: 100%;
          }
          
          .position-stats-table th:nth-child(2),
          .position-stats-table td:nth-child(2),
          .position-stats-table th:nth-child(3),
          .position-stats-table td:nth-child(3) {
            display: none;
          }
          
          .compliance-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default MultiPositionComplianceDashboard;