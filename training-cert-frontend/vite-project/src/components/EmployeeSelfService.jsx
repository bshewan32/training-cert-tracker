import { useState, useEffect } from 'react';
import CompanyDocuments from './CompanyDocuments';

const EmployeeSelfService = ({ token, onLogout }) => {
  const [employee, setEmployee] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expiringSoon: 0,
    expired: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, expiring, expired
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCert, setSelectedCert] = useState(null);
  const [activeTab, setActiveTab] = useState('certificates'); // 'certificates' or 'documents'

  useEffect(() => {
    fetchEmployeeData();
  }, [token]);

  const fetchEmployeeData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch employee info and certificates
      const [certResponse, complianceResponse] = await Promise.all([
        fetch('/api/employees/my-certificates', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/employees/my-compliance', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!certResponse.ok || !complianceResponse.ok) {
        throw new Error('Failed to fetch employee data');
      }

      const certData = await certResponse.json();
      const complianceData = await complianceResponse.json();

      setEmployee(certData.employee);
      setCertificates(certData.certificates || []);
      setStats(complianceData.stats || { total: 0, active: 0, expiringSoon: 0, expired: 0 });
    } catch (err) {
      console.error('Error fetching employee data:', err);
      setError(err.message || 'Failed to load your certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleViewImage = async (certId) => {
    try {
      const response = await fetch(`/api/employees/my-certificates/${certId}/image`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      window.open(imageUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(imageUrl), 100);
    } catch (err) {
      setError('Failed to load certificate image');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#10b981';
      case 'EXPIRING SOON': return '#f59e0b';
      case 'EXPIRED': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ACTIVE': return '✓';
      case 'EXPIRING SOON': return '⚠️';
      case 'EXPIRED': return '✗';
      default: return '•';
    }
  };

  // Filter certificates
  const filteredCertificates = certificates.filter(cert => {
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'active' && cert.status === 'ACTIVE') ||
      (filterStatus === 'expiring' && cert.status === 'EXPIRING SOON') ||
      (filterStatus === 'expired' && cert.status === 'EXPIRED');
    
    const searchMatch = !searchTerm || 
      cert.certificateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.positionTitle?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return statusMatch && searchMatch;
  });

  if (loading) {
    return (
      <div className="employee-self-service">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your certificates...</p>
        </div>
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className="employee-self-service">
        <div className="error-container">
          <h2>⚠️ Unable to Load</h2>
          <p>{error}</p>
          <button onClick={fetchEmployeeData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-self-service">
      {/* Header */}
      <div className="mobile-header">
        <div className="header-content">
          <div className="welcome-section">
            <h1>My Dashboard</h1>
            <p className="employee-name">{employee?.name || 'Loading...'}</p>
          </div>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '2px solid #e5e7eb',
        padding: '0 20px',
        backgroundColor: 'white'
      }}>
        <button
          onClick={() => setActiveTab('certificates')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: activeTab === 'certificates' ? '#667eea' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'certificates' ? '3px solid #667eea' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          📜 My Certificates
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: activeTab === 'documents' ? '#667eea' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'documents' ? '3px solid #667eea' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          📚 Company Documents
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'certificates' ? (
        <>
          {/* Stats Cards */}
          <div className="stats-container">
            <div className="stat-card total">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-card active">
              <div className="stat-value">{stats.active}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-card expiring">
              <div className="stat-value">{stats.expiringSoon}</div>
              <div className="stat-label">Expiring</div>
            </div>
            <div className="stat-card expired">
              <div className="stat-value">{stats.expired}</div>
              <div className="stat-label">Expired</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All
              </button>
              <button 
                className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                Active
              </button>
              <button 
                className={`filter-btn ${filterStatus === 'expiring' ? 'active' : ''}`}
                onClick={() => setFilterStatus('expiring')}
              >
                Expiring
              </button>
              <button 
                className={`filter-btn ${filterStatus === 'expired' ? 'active' : ''}`}
                onClick={() => setFilterStatus('expired')}
              >
                Expired
              </button>
            </div>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search certificates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Certificates List */}
          <div className="certificates-container">
            {filteredCertificates.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No certificates found</h3>
                <p>
                  {filterStatus !== 'all' 
                    ? `You don't have any ${filterStatus} certificates`
                    : 'No certificates have been added to your profile yet'}
                </p>
              </div>
            ) : (
              filteredCertificates.map(cert => (
                <div 
                  key={cert._id} 
                  className="certificate-card"
                  onClick={() => setSelectedCert(cert)}
                >
                  <div className="card-header">
                    <div className="cert-info">
                      <h3 className="cert-name">{cert.certificateName}</h3>
                      <p className="cert-position">
                        {cert.positionTitle}
                        {cert.positionDepartment && ` • ${cert.positionDepartment}`}
                      </p>
                    </div>
                    <div 
                      className="status-badge"
                      style={{ 
                        backgroundColor: getStatusColor(cert.status) + '20',
                        color: getStatusColor(cert.status),
                        borderColor: getStatusColor(cert.status)
                      }}
                    >
                      {getStatusIcon(cert.status)} {cert.status}
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="cert-dates">
                      <div className="date-item">
                        <span className="date-label">Issued:</span>
                        <span className="date-value">
                          {new Date(cert.issueDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="date-item">
                        <span className="date-label">Expires:</span>
                        <span className="date-value">
                          {new Date(cert.expirationDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {cert.status === 'EXPIRING SOON' && cert.daysUntilExpiration !== undefined && (
                      <div className="urgency-banner expiring">
                        ⚠️ Expires in {cert.daysUntilExpiration} day{cert.daysUntilExpiration !== 1 ? 's' : ''}
                      </div>
                    )}

                    {cert.status === 'EXPIRED' && (
                      <div className="urgency-banner expired">
                        ✗ This certificate has expired
                      </div>
                    )}
                  </div>

                  {(cert.gridFsFileId || cert.onedriveFileId) && (
                    <div className="card-footer">
                      <button
                        className="view-cert-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewImage(cert._id);
                        }}
                      >
                        📎 View Certificate Image
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Certificate Detail Modal */}
          {selectedCert && (
            <div className="modal-overlay" onClick={() => setSelectedCert(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{selectedCert.certificateName}</h2>
                  <button 
                    className="close-btn"
                    onClick={() => setSelectedCert(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="modal-body">
                  <div className="detail-row">
                    <span className="detail-label">Position:</span>
                    <span className="detail-value">{selectedCert.positionTitle}</span>
                  </div>
                  {selectedCert.positionDepartment && (
                    <div className="detail-row">
                      <span className="detail-label">Department:</span>
                      <span className="detail-value">{selectedCert.positionDepartment}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span 
                      className="detail-value"
                      style={{ 
                        color: getStatusColor(selectedCert.status),
                        fontWeight: 'bold'
                      }}
                    >
                      {selectedCert.status}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Issue Date:</span>
                    <span className="detail-value">
                      {new Date(selectedCert.issueDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Expiration Date:</span>
                    <span className="detail-value">
                      {new Date(selectedCert.expirationDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  {selectedCert.validityPeriod && (
                    <div className="detail-row">
                      <span className="detail-label">Validity Period:</span>
                      <span className="detail-value">{selectedCert.validityPeriod} months</span>
                    </div>
                  )}
                  {(selectedCert.gridFsFileId || selectedCert.onedriveFileId) && (
                    <button
                      className="modal-view-btn"
                      onClick={() => handleViewImage(selectedCert._id)}
                    >
                      📎 View Certificate Image
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <CompanyDocuments token={token} />
      )}

      <style jsx>{`
        .employee-self-service {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding-bottom: 20px;
        }

        .loading-container, .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          color: white;
          text-align: center;
          padding: 20px;
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-container h2 {
          margin-bottom: 10px;
        }

        .retry-btn {
          margin-top: 20px;
          padding: 12px 24px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .mobile-header {
          background: white;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }

        .welcome-section h1 {
          margin: 0;
          font-size: 1.5rem;
          color: #1a202c;
        }

        .employee-name {
          margin: 5px 0 0 0;
          color: #667eea;
          font-weight: 600;
        }

        .logout-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-btn:hover {
          background: #dc2626;
        }

        .stats-container {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          max-width: 1200px;
          margin: 20px auto;
          padding: 0 20px;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .stat-card.total {
          border-top: 4px solid #667eea;
        }

        .stat-card.active {
          border-top: 4px solid #10b981;
        }

        .stat-card.expiring {
          border-top: 4px solid #f59e0b;
        }

        .stat-card.expired {
          border-top: 4px solid #ef4444;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 800;
          color: #1a202c;
          margin-bottom: 5px;
        }

        .stat-label {
          font-size: 0.85rem;
          color: #6b7280;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .filter-bar {
          max-width: 1200px;
          margin: 20px auto;
          padding: 0 20px;
        }

        .filter-buttons {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
          overflow-x: auto;
          padding-bottom: 5px;
        }

        .filter-btn {
          background: white;
          border: 2px solid #e5e7eb;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          border-color: #667eea;
          color: #667eea;
        }

        .filter-btn.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .search-box input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid white;
          border-radius: 8px;
          font-size: 1rem;
          background: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .search-box input:focus {
          outline: none;
          border-color: #667eea;
        }

        .error-message {
          max-width: 1200px;
          margin: 0 auto 20px;
          padding: 12px 20px;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 8px;
          margin-left: 20px;
          margin-right: 20px;
        }

        .certificates-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: grid;
          gap: 15px;
        }

        .certificate-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: all 0.2s;
        }

        .certificate-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
          gap: 15px;
        }

        .cert-info {
          flex: 1;
          min-width: 0;
        }

        .cert-name {
          margin: 0 0 5px 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #1a202c;
        }

        .cert-position {
          margin: 0;
          color: #6b7280;
          font-size: 0.9rem;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          white-space: nowrap;
          border: 2px solid;
        }

        .card-body {
          margin-bottom: 15px;
        }

        .cert-dates {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 10px;
        }

        .date-item {
          display: flex;
          flex-direction: column;
        }

        .date-label {
          font-size: 0.75rem;
          color: #9ca3af;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .date-value {
          font-size: 0.95rem;
          color: #1a202c;
          font-weight: 600;
        }

        .urgency-banner {
          padding: 10px;
          border-radius: 8px;
          font-weight: 600;
          text-align: center;
          margin-top: 10px;
        }

        .urgency-banner.expiring {
          background: #fef3c7;
          color: #92400e;
        }

        .urgency-banner.expired {
          background: #fee2e2;
          color: #991b1b;
        }

        .card-footer {
          border-top: 1px solid #e5e7eb;
          padding-top: 15px;
        }

        .view-cert-btn {
          width: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .view-cert-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 20px;
        }

        .empty-state h3 {
          margin: 0 0 10px 0;
          color: #1a202c;
        }

        .empty-state p {
          color: #6b7280;
          margin: 0;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 2px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          color: #1a202c;
          font-size: 1.25rem;
        }

        .close-btn {
          background: #f3f4f6;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 1.2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: #e5e7eb;
        }

        .modal-body {
          padding: 20px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .detail-label {
          color: #6b7280;
          font-weight: 600;
        }

        .detail-value {
          color: #1a202c;
          font-weight: 600;
          text-align: right;
        }

        .modal-view-btn {
          width: 100%;
          margin-top: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
        }

        @media (max-width: 768px) {
          .stats-container {
            grid-template-columns: repeat(2, 1fr);
          }

          .cert-dates {
            grid-template-columns: 1fr;
          }

          .welcome-section h1 {
            font-size: 1.25rem;
          }

          .logout-btn {
            padding: 8px 16px;
            font-size: 0.9rem;
          }
        }

        @media (max-width: 480px) {
          .stats-container {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .stat-card {
            padding: 15px 10px;
          }

          .stat-value {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeeSelfService;