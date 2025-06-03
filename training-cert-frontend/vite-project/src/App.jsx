import {
  useState,
  useEffect
} from 'react';
import './App.css';
import ExcelTemplateUploader from './components/ExcelTemplateUploader';
import ExcelExporter from './components/ExcelExporter';
import ExcelDateFormatter from './components/ExcelDateFormatter';
import PositionRequirements from './components/PositionRequirements';
import EmployeeRequirements from './components/EmployeeRequirements';
import EmployeeForm from './components/EmployeeForm';
import EmployeePositionsDashboard from './components/EmployeePositionsDashboard';
import MultiPositionComplianceDashboard from './components/MultiPositionComplianceDashboard';
import ComplianceWithDashboard from './components/ComplianceWithDashboard';

function App() {
  const [selectedFilterEmployee, setSelectedFilterEmployee] = useState('');
  const [selectedFilterCertType, setSelectedFilterCertType] = useState('');
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [selectedPositionForRequirements, setSelectedPositionForRequirements] = useState(null);
  const [activeExcelTool, setActiveExcelTool] = useState('exporter');

  const [view, setView] = useState('login');
  const [token, setToken] = useState(localStorage.getItem('authToken') || '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [certificates, setCertificates] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalCertificates: 0,
    expiringSoon: 0,
    expired: 0,
    activeUsers: 0
  });

  const [activeTab, setActiveTab] = useState('bulkImport');
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [certificateTypes, setCertificateTypes] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [adminActiveTab, setAdminActiveTab] = useState('overview');
  const [showArchivedEmployees, setShowArchivedEmployees] = useState(false);
  const [certificateDashboardKey, setCertificateDashboardKey] = useState(0);

  // Debug: Log when employees data changes
  useEffect(() => {
    console.log('Employees data changed:', employees.length);
    if (selectedEmployeeForEdit) {
      const updatedEmployee = employees.find(emp => emp._id === selectedEmployeeForEdit._id);
      console.log('Updated employee in main state:', updatedEmployee);
    }
  }, [employees, selectedEmployeeForEdit]);

  // Initialize authentication state from localStorage on app load
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';

    if (storedToken) {
      setToken(storedToken);
      setIsAdmin(storedIsAdmin);
      // Set initial view - always start with certificates for simplicity
      setView('certificates');
    }
  }, []);

  // Modified handleBulkUpload - This will be handled by the new component
  const handleBulkUploadSuccess = (result) => {
    setMessage(result.message || 'Data imported successfully');
    fetchSetupData(); // Refresh the data
  };

  const handleBulkUploadError = (err) => {
    setError(err.message || 'Error importing data');
  };

  const handleSubmit = async (e, type) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    console.log('Login attempt:', { type, data: { ...data, password: '[REDACTED]' } });

    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/users/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('Login response status:', response.status);
      const result = await response.json();
      console.log('Login response data:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Authentication failed');
      }

      setToken(result.token);
      localStorage.setItem('authToken', result.token);
      localStorage.setItem('isAdmin', result.isAdmin);
      setIsAdmin(result.isAdmin);
      setMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} successful!`);

      // Always go to certificates view for simplicity
      setView('certificates');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('authToken');
    localStorage.removeItem('isAdmin');
    setIsAdmin(false);
    setView('login');
    setCertificates([]);
    setDashboardStats({
      totalCertificates: 0,
      expiringSoon: 0,
      expired: 0,
      activeUsers: 0
    });
  };

  const sendReminder = async (certificateId) => {
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/admin/send-reminder/${certificateId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to send reminder');
      setMessage('Reminder sent successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchCertificates = async () => {
  try {
    const response = await fetch('https://training-cert-tracker.onrender.com/api/certificates', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    if (!response.ok) throw new Error('Failed to fetch certificates')
    const data = await response.json()
    console.log('Certificates fetched:', data.length, data); // Add this debug line
    setCertificates(data)
  } catch (err) {
    console.error('Error fetching certificates:', err); // Add this debug line
    setError(err.message)
  }
}

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setDashboardStats(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (token && (view === 'certificates' || view === 'admin')) {
      (async () => {
        await Promise.all([
          fetchSetupData(true),
          fetchCertificates()
        ]);
      })();
    } else if (token && view === 'setup') {
      fetchSetupData(showArchivedEmployees);
    }
    if (token && view === 'admin') {
      fetchDashboardStats();
    }
  }, [token, view]);
  

  // Set view to formatter if on hidden-tools/date-formatter path
  useEffect(() => {
    if (window.location.pathname === '/hidden-tools/date-formatter') {
      setView('formatter');
    }
  }, []);

  const fetchSetupData = async (includeInactive = false) => {
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup?includeInactive=${includeInactive}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch setup data');
      const data = await response.json();
      console.log('Setup data received:', data);
      console.log('Employees:', data.employees);
      setEmployees(data.employees);
      setPositions(data.positions);
      setCertificateTypes(data.certificateTypes);
    } catch (err) {
      console.error('Setup data fetch error:', err);
      setError(err.message);
    }
  };

  const handleDelete = async (type, id) => {
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/${type}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error(`Failed to delete ${type}`);
      fetchSetupData();
      setMessage(`${type} removed successfully`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    console.log('Submitting employee data:', data);

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/employee', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      console.log('Server response:', result);

      if (!response.ok) throw new Error('Failed to add employee');
      await fetchSetupData();
      e.target.reset();
      setMessage('Employee added successfully');
    } catch (err) {
      console.error('Employee submit error:', err);
      setError(err.message);
    }
  };

  // Similar handlers for positions and certificate types
  const handlePositionSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/position', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to add position');
      fetchSetupData();
      e.target.reset();
      setMessage('Position added successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCertTypeSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/certificatetype', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to add certificatetype');
      fetchSetupData();
      e.target.reset();
      setMessage('Certificate type added successfully');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCertificateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Get employee name from selected employee
    const employee = employees.find(emp => emp._id === data.staffMember);
    if (!employee) {
      setError('Please select a valid employee');
      return;
    }

    // Get certificate type name
    const certType = certificateTypes.find(cert => cert._id === data.certificateType);
    if (!certType) {
      setError('Please select a valid certificate type');
      return;
    }

    // Prepare certificate data
    const certificateData = {
      staffMember: employee.name,
      position: selectedPosition,
      certificateType: certType.name,
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
      fetchCertificates();
      
      // Reset form
      e.target.reset();
      setSelectedEmployee(null);
      setSelectedPosition('');
      setIssueDate('');
      setExpiryDate('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCertificateDelete = async (certId) => {
    if (window.confirm('Are you sure you want to delete this certificate?')) {
      try {
        const response = await fetch(`https://training-cert-tracker.onrender.com/api/certificates/${certId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error('Failed to delete certificate');

        setMessage('Certificate deleted successfully');
        fetchCertificates(); // Refresh certificates
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleViewEmployee = async (employeeName) => {
    try {
      await fetchSetupData(true);
      await fetchCertificates();
      let employee = employees.find(emp => emp.name === employeeName);

      if (!employee) {
        await fetchSetupData(true);
        employee = employees.find(emp => emp.name === employeeName);
      }

      if (employee) {
        setSelectedEmployeeForEdit(employee);
        setView('employeeDetails');
      } else {
        setError('Employee not found');
      }
    } catch (err) {
      setError('Failed to load employee details: ' + err.message);
    }
  };

  return (
    <div className="container">
      <h1>Certificate Tracker</h1>
      <div className="content">
        {error && <div className="error">{error}</div>}
        {message && <div className="message">{message}</div>}

        {token && (
          <button
            onClick={handleLogout}
            className="logout-button"
          >
            Logout
          </button>
        )}

        {/* Hidden Excel Date Formatter view */}
        {view === 'formatter' && (
          <div className="hidden-tools">
            <ExcelDateFormatter />
            <div className="back-link">
              <button
                onClick={() => setView('certificates')}
                className="back-button"
              >
                Back to Certificate Tracker
              </button>
            </div>
          </div>
        )}

        {/* Login/Register View */}
        {(view === 'login' || view === 'register') && (
          <form onSubmit={(e) => handleSubmit(e, view)} className="form">
            {view === 'register' && (
              <div className="form-group">
                <label>Email:</label>
                <input type="email" name="email" required />
              </div>
            )}
            <div className="form-group">
              <label>Username:</label>
              <input type="text" name="username" required />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input type="password" name="password" required />
            </div>
            <button type="submit">
              {view === 'login' ? 'Login' : 'Register'}
            </button>
            <button
              type="button"
              onClick={() => setView(view === 'login' ? 'register' : 'login')}
            >
              {view === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
            </button>
          </form>
        )}

        
        {/* Main Certificates View - Enhanced with Dashboard */}
    {view === 'certificates' && (
      <>
        {/* Only render if we have data loaded */}
        {employees.length > 0 && positions.length > 0 && certificateTypes.length > 0 ? (
          <CertificatesWithDashboard
            key={`dashboard-${certificateDashboardKey}`}
            token={token}
            employees={employees}
            positions={positions}
            certificateTypes={certificateTypes}
            certificates={certificates}
            isAdmin={isAdmin}
            onViewEmployee={handleViewEmployee}
            onViewAdmin={() => setView('admin')}
            onCertificateAdded={(result) => {
              setMessage('Certificate added successfully!');
              fetchCertificates();
            }}
            onCertificateDeleted={handleCertificateDelete}
          />
        ) : (
          <div className="loading-container">
            <div className="loading-message">Loading dashboard data...</div>
          </div>
        )}
      </>
    )}

        {/* Employee Details View */}
        {view === 'employeeDetails' && selectedEmployeeForEdit && (
          <div className="employee-details">
            <div className="employee-details-header">
              <h2>Employee Details: {selectedEmployeeForEdit.name}</h2>
              <div className="header-actions">
                <button
                  onClick={() => {
                    // Force a fresh data load when returning to certificates
                    fetchSetupData(true).then(() => {
                      setCertificateDashboardKey(prev => prev + 1);
                      setView('certificates');
                    });
                  }}
                  className="back-button"
                >
                  Back to Dashboard
                </button>

                {selectedEmployeeForEdit.active === false ? (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${selectedEmployeeForEdit._id}/reactivate`, {
                          method: 'PUT',
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });

                        if (!response.ok) throw new Error('Failed to reactivate employee');

                        const result = await response.json();
                        setSelectedEmployeeForEdit(result.employee);
                        setMessage(`${selectedEmployeeForEdit.name} has been reactivated`);
                        await fetchSetupData(true);
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                    className="reactivate-header-btn"
                  >
                    🔄 Reactivate Employee
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (confirm(`Archive ${selectedEmployeeForEdit.name}? They will be excluded from compliance calculations.`)) {
                        try {
                          const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${selectedEmployeeForEdit._id}/archive`, {
                            method: 'PUT',
                            headers: {
                              'Authorization': `Bearer ${token}`
                            }
                          });

                          if (!response.ok) throw new Error('Failed to archive employee');

                          const result = await response.json();
                          setSelectedEmployeeForEdit(result.employee);
                          setMessage(`${selectedEmployeeForEdit.name} has been archived`);
                          await fetchSetupData(true);
                        } catch (err) {
                          setError(err.message);
                        }
                      }
                    }}
                    className="archive-header-btn"
                  >
                    📁 Archive Employee
                  </button>
                )}
              </div>
            </div>

            {selectedEmployeeForEdit.active === false && (
              <div className="employee-status-alert archived">
                <div className="alert-content">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-text">
                    <strong>This employee is archived</strong>
                    <p>They are excluded from compliance calculations and won't appear in certificate forms.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="details-section">
              <h3>Personal Information & Positions</h3>
              <EmployeeForm
                employee={selectedEmployeeForEdit}
                positions={positions}
                token={token}
                showArchiveControls={true}
                onSubmit={async (updatedEmployee) => {
                  try {
                    const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${selectedEmployeeForEdit._id}`, {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify(updatedEmployee)
                    });

                    if (!response.ok) throw new Error('Failed to update employee');

                    const result = await response.json();
                    console.log('Employee update API response:', result);
                    setMessage('Employee updated successfully');

                    // Refresh all data to ensure UI components get updated employee positions and certificates,
                    // then force dashboard to remount with fresh data
                    await Promise.all([
                      fetchSetupData(true),
                      fetchCertificates()
                    ]);
                    setCertificateDashboardKey(prev => prev + 1); // <- Add this line here

                    // Wait a bit for state to update, then check
                    setTimeout(() => {
                      console.log('After fetchSetupData timeout, employees state:', employees.length);
                      const updatedEmp = employees.find(emp => emp._id === selectedEmployeeForEdit._id);
                      console.log('Updated employee after refresh:', updatedEmp);
                    }, 500);

                    setSelectedEmployeeForEdit(result);
                  } catch (err) {
                    setError(err.message);
                  }
                }}
                onCancel={() => {
                  // Force a fresh data load when returning to certificates
                  fetchSetupData(true).then(() => {
                    setCertificateDashboardKey(prev => prev + 1); // <- Add this line
                    setView('certificates');
                  });
                }}
              />
            </div>

            <div className="details-section">
              <h3>Certificate History</h3>
              {selectedEmployeeForEdit.active === false && (
                <div className="archived-employee-note">
                  <p><strong>Note:</strong> This employee is archived, but you can still view their certificate history.</p>
                </div>
              )}

              <div className="table-container">
                <table className="employee-certificates-table">
                  <thead>
                    <tr>
                      <th>Certificate Type</th>
                      <th>Position</th>
                      <th>Issue Date</th>
                      <th>Expiration Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificates
                      .filter(cert => cert.staffMember === selectedEmployeeForEdit.name)
                      .map(cert => {
                        const expirationDate = new Date(cert.expirationDate);
                        const today = new Date();
                        const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
                        let statusClass = 'status-active';
                        if (daysUntilExpiration <= 0) statusClass = 'status-expired';
                        else if (daysUntilExpiration <= 30) statusClass = 'status-expiring';

                        const position = positions.find(pos => pos._id === cert.position) || {};
                        const positionTitle = position.title || cert.position;

                        return (
                          <tr key={cert._id} className={statusClass}>
                            <td>{cert.certificateName || cert.certificateType}</td>
                            <td>{positionTitle}</td>
                            <td>{new Date(cert.issueDate).toLocaleDateString()}</td>
                            <td>{new Date(cert.expirationDate).toLocaleDateString()}</td>
                            <td>
                              <span className={`status-badge ${statusClass.replace('status-', '')}`}>
                                {cert.status}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => handleCertificateDelete(cert._id)}
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
        )}

        {/* Admin Dashboard View - Cleaned Up */}
        {view === 'admin' && (
          <div className="admin-dashboard">
            <div className="admin-header">
              <h2>Administration</h2>
              <button
                onClick={() => setView('certificates')}
                className="back-button"
              >
                Back to Main Dashboard
              </button>
            </div>

            <div className="admin-quick-actions">
              <div className="admin-card">
                <div className="admin-card-icon">⚙️</div>
                <div className="admin-card-content">
                  <h3>System Setup</h3>
                  <p>Manage positions, certificate types, and bulk import data</p>
                  <button
                    onClick={() => setView('setup')}
                    className="admin-action-btn"
                  >
                    Open Setup
                  </button>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-icon">📊</div>
                <div className="admin-card-content">
                  <h3>Excel Tools</h3>
                  <p>Export certificate data and format Excel files</p>
                  <button
                    onClick={() => setView('excelTools')}
                    className="admin-action-btn"
                  >
                    Open Tools
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats Summary */}
            <div className="admin-stats-summary">
              <h3>System Overview</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Total Certificates</span>
                  <span className="stat-value">{certificates.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Active Employees</span>
                  <span className="stat-value">{employees.filter(emp => emp.active !== false).length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Certificate Types</span>
                  <span className="stat-value">{certificateTypes.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Positions</span>
                  <span className="stat-value">{positions.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Setup View - Streamlined without Employee Management */}
        {view === 'setup' && (
          <div className="setup-dashboard">
            <div className="setup-header">
              <h2>System Setup</h2>
              <button
                onClick={() => setView('admin')}
                className="back-button"
              >
                Back to Administration
              </button>
            </div>

            <div className="setup-tabs">
              <button
                className={`tab-button ${activeTab === 'bulkImport' ? 'active' : ''}`}
                onClick={() => setActiveTab('bulkImport')}
              >
                Bulk Import
              </button>
              <button
                className={`tab-button ${activeTab === 'positions' ? 'active' : ''}`}
                onClick={() => setActiveTab('positions')}
              >
                Positions
              </button>
              <button
                className={`tab-button ${activeTab === 'certificateTypes' ? 'active' : ''}`}
                onClick={() => setActiveTab('certificateTypes')}
              >
                Certificate Types
              </button>
            </div>

            <div className="setup-content">
              {/* Bulk Import Tab */}
              {activeTab === 'bulkImport' && (
                <div className="setup-section">
                  <div className="setup-section-header">
                    <h3>Bulk Data Import</h3>
                    <p>Upload Excel files to import multiple employees, positions, and certificates at once.</p>
                  </div>
                  <ExcelTemplateUploader
                    token={token}
                    onSuccess={handleBulkUploadSuccess}
                    onError={handleBulkUploadError}
                  />
                </div>
              )}

              {/* Positions Tab */}
              {activeTab === 'positions' && (
                <div className="setup-section">
                  <div className="setup-section-header">
                    <h3>Manage Positions</h3>
                    <p>Create and manage job positions, departments, and their certificate requirements.</p>
                  </div>
                  
                  <form onSubmit={handlePositionSubmit} className="setup-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Position Title:</label>
                        <input type="text" name="title" required placeholder="e.g. Site Manager, Electrician" />
                      </div>
                      <div className="form-group">
                        <label>Department:</label>
                        <input type="text" name="department" placeholder="e.g. Construction, Maintenance" />
                      </div>
                    </div>
                    <button type="submit" className="add-button">Add Position</button>
                  </form>
                  
                  <div className="setup-list">
                    <h4>Existing Positions ({positions.length})</h4>
                    {positions.length === 0 ? (
                      <div className="empty-state">
                        <p>No positions created yet. Add your first position above.</p>
                      </div>
                    ) : (
                      positions.map(pos => (
                        <div key={pos._id} className="list-item">
                          <div className="item-info">
                            <span className="item-title">{pos.title}</span>
                            <span className="item-subtitle">{pos.department || 'No Department'}</span>
                          </div>
                          <div className="button-group">
                            <button
                              onClick={() => setSelectedPositionForRequirements(pos)}
                              className="manage-button"
                            >
                              Certificate Requirements
                            </button>
                            <button
                              onClick={() => handleDelete('position', pos._id)}
                              className="delete-button"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Position Requirements Modal */}
                  {selectedPositionForRequirements && (
                    <div className="requirements-modal">
                      <div className="requirements-content">
                        <div className="requirements-header">
                          <h4>Certificate Requirements for {selectedPositionForRequirements.title}</h4>
                          <button
                            onClick={() => setSelectedPositionForRequirements(null)}
                            className="close-button"
                          >
                            ✕
                          </button>
                        </div>
                        <PositionRequirements 
                          position={selectedPositionForRequirements}
                          token={token}
                          certificateTypes={certificateTypes}
                          onUpdate={() => {
                            fetchSetupData();
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Certificate Types Tab */}
              {activeTab === 'certificateTypes' && (
                <div className="setup-section">
                  <div className="setup-section-header">
                    <h3>Manage Certificate Types</h3>
                    <p>Define the types of certificates your organization tracks and their validity periods.</p>
                  </div>
                  
                  <div className="cert-type-info">
                    <div className="info-icon">💡</div>
                    <div>
                      <strong>Tip:</strong> The validity period you set here will automatically calculate expiration dates when issuing certificates.
                    </div>
                  </div>
                  
                  <form onSubmit={handleCertTypeSubmit} className="setup-form">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Certificate Name:</label>
                        <input type="text" name="name" required placeholder="e.g. First Aid, White Card, Forklift License" />
                      </div>
                      <div className="form-group">
                        <label>Validity Period (months):</label>
                        <input 
                          type="number" 
                          name="validityPeriod" 
                          min="1" 
                          max="120"
                          required 
                          placeholder="12"
                        />
                        <small className="validity-help">
                          Common: First Aid (36), CPR (12), Safety Training (24)
                        </small>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Description (Optional):</label>
                      <textarea 
                        name="description" 
                        placeholder="Brief description of this certificate type and when it's required"
                        rows="2"
                      ></textarea>
                    </div>
                    <button type="submit" className="add-button">Add Certificate Type</button>
                  </form>
                  
                  <div className="setup-list">
                    <h4>Existing Certificate Types ({certificateTypes.length})</h4>
                    {certificateTypes.length === 0 ? (
                      <div className="empty-state">
                        <p>No certificate types created yet. Add your first certificate type above.</p>
                      </div>
                    ) : (
                      certificateTypes.map(cert => (
                        <div key={cert._id} className="list-item cert-type-item">
                          <div className="cert-type-details">
                            <div className="item-info">
                              <span className="item-title">{cert.name}</span>
                              <span className="item-subtitle">
                                Valid for {cert.validityPeriod} months
                                {cert.description && ` • ${cert.description}`}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete('certificateType', cert._id)}
                            className="delete-button"
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Excel Tools view */}
        {view === 'excelTools' && (
          <div className="excel-tools">
            <h2>Excel Tools</h2>
            <button
              onClick={() => setView('admin')}
              className="back-button"
            >
              Back to Dashboard
            </button>

            <div className="tool-tabs">
              <button
                className={`tool-tab ${activeExcelTool === 'exporter' ? 'active' : ''}`}
                onClick={() => setActiveExcelTool('exporter')}
              >
                Export Certificates
              </button>
              <button
                className={`tool-tab ${activeExcelTool === 'formatter' ? 'active' : ''}`}
                onClick={() => setActiveExcelTool('formatter')}
              >
                Date Formatter
              </button>
            </div>

            <div className="tool-content">
              {activeExcelTool === 'exporter' && (
                <ExcelExporter token={token} />
              )}

              {activeExcelTool === 'formatter' && (
                <ExcelDateFormatter />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
