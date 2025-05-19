import { useState, useEffect } from 'react'
import './App.css'
import ExcelTemplateUploader from 'src/components/ExcelTemplateUploader'


function App() {
  const [selectedFilterEmployee, setSelectedFilterEmployee] = useState('');
  const [selectedFilterCertType, setSelectedFilterCertType] = useState('');
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [view, setView] = useState('login')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [certificates, setCertificates] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [dashboardStats, setDashboardStats] = useState({
    totalCertificates: 0,
    expiringSoon: 0,
    expired: 0,
    activeUsers: 0
  })

  const [activeTab, setActiveTab] = useState('bulkImport')
  const [employees, setEmployees] = useState([])
  const [positions, setPositions] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [certificateTypes, setCertificateTypes] = useState([])
  const [selectedPosition, setSelectedPosition] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [importFile, setImportFile] = useState(null);

  // Modified handleBulkUpload - This will be handled by the new component
  const handleBulkUploadSuccess = (result) => {
    setMessage(result.message || 'Data imported successfully');
    fetchSetupData(); // Refresh the data
  };

  const handleBulkUploadError = (err) => {
    setError(err.message || 'Error importing data');
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!importFile) {
      setError('Please select a file to import');
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/bulk-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to import data');

      const result = await response.json();
      setMessage('Data imported successfully');
      fetchSetupData(); // Refresh the data
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e, type) => {
    e.preventDefault()
    setError('')
    setMessage('')

    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())

    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/users/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Authentication failed')
      }

      setToken(result.token)
      setIsAdmin(result.isAdmin) // Add this line
      setMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} successful!`)
      setView('certificates')
    } catch (err) {
      setError(err.message)
    }
  }
  const handleLogout = () => {
    setToken('')
    setIsAdmin(false)
    setView('login')
    setCertificates([])
    setDashboardStats({
      totalCertificates: 0,
      expiringSoon: 0,
      expired: 0,
      activeUsers: 0
    })
  }
  const handleCertificateSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    const formData = new FormData(e.target)

    // Get the selected employee and certificate type
    const employee = employees.find(emp => emp._id === formData.get('staffMember'));
    const certType = certificateTypes.find(cert => cert._id === formData.get('certificateType'));

    const data = {
      staffMember: employee?.name,
      position: selectedPosition,
      certificateType: certType?.name,
      issueDate: formData.get('issueDate'),
      expirationDate: expiryDate
    }

    console.log('Submitting certificate data:', data);

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/certificates/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      console.log('Server response:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit certificate')
      }

      setMessage('Certificate submitted successfully!')
      e.target.reset()
      setSelectedPosition('')
      setSelectedEmployee(null)
      setIssueDate('')
      setExpiryDate('')
      fetchCertificates()
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message)
    }
  }
  const sendReminder = async (certificateId) => {
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/admin/send-reminder/${certificateId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Failed to send reminder')
      setMessage('Reminder sent successfully')
    } catch (err) {
      setError(err.message)
    }
  }
  const fetchCertificates = async () => {
    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/certificates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch certificates')
      const data = await response.json()
      setCertificates(data)
    } catch (err) {
      setError(err.message)
    }
  }
  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch dashboard data')
      const data = await response.json()
      setDashboardStats(data)
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => {
    if (token) {
      if (view === 'certificates' || view === 'admin') {
        fetchCertificates();
      }
      if (view === 'admin') {
        fetchDashboardStats();
      }
      if (view === 'certificates' || view === 'setup') {
        fetchSetupData(); // Add this to load dropdown data
      }
    }
  }, [token, view]);

  const fetchSetupData = async () => {
    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch setup data')
      const data = await response.json()
      console.log('Setup data received:', data); // Add this
      console.log('Employees:', data.employees); // Add this
      console.log('Positions:', data.positions); // Add this
      setEmployees(data.employees)
      setPositions(data.positions)
      setCertificateTypes(data.certificateTypes)
    } catch (err) {
      console.error('Setup data fetch error:', err); // Add this
      setError(err.message)
    }
  }

  const handleDelete = async (type, id) => {
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/${type}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error(`Failed to delete ${type}`)
      fetchSetupData()
      setMessage(`${type} removed successfully`)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())

    console.log('Submitting employee data:', data); // Add this

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/employee', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      const result = await response.json(); // Add this
      console.log('Server response:', result); // Add this

      if (!response.ok) throw new Error('Failed to add employee')
      await fetchSetupData() // Add await here
      e.target.reset()
      setMessage('Employee added successfully')
    } catch (err) {
      console.error('Employee submit error:', err); // Add this
      setError(err.message)
    }
  }

  // Similar handlers for positions and certificate types
  const handlePositionSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/position', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to add position')
      fetchSetupData()
      e.target.reset()
      setMessage('position added successfully')
    } catch (err) {
      setError(err.message)
    }
    // Similar to handleEmployeeSubmit but for positions
  }

  const handleCertTypeSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/certificatetype', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      if (!response.ok) throw new Error('Failed to add certificatetype')
      fetchSetupData()
      e.target.reset()
      setMessage('certificatetype added successfully')
    } catch (err) {
      setError(err.message)
    }
    // Similar to handleEmployeeSubmit but for certificate types
  }
  const handleEmployeeUpdate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${selectedEmployeeForEdit._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedEmployeeForEdit)
      });
  
      if (!response.ok) throw new Error('Failed to update employee');
      
      setMessage('Employee updated successfully');
      await fetchSetupData(); // Refresh data
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
          >Logout</button>
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
              onClick={() => setView(view === 'login' ? 'register' : 'login')}>
              {view === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
            </button>
          </form>
        )}

        {/* Admin Dashboard View */}
        {view === 'admin' && (
          <div className="admin-dashboard">
            <h2>Admin Dashboard</h2>
            <div className="dashboard-stats">
              <div className="stat-card">
                <h3>Total Certificates</h3>
                <p className="stat-number">{dashboardStats.totalCertificates}</p>
              </div>
              <div className="stat-card warning">
                <h3>Expiring Soon</h3>
                <p className="stat-number">{dashboardStats.expiringSoon}</p>
              </div>
              <div className="stat-card danger">
                <h3>Expired</h3>
                <p className="stat-number">{dashboardStats.expired}</p>
              </div>
              <div className="stat-card">
                <h3>Active Users</h3>
                <p className="stat-number">{dashboardStats.activeUsers}</p>
              </div>
            </div>

            <div className="admin-buttons">
              <button
                type="button"
                onClick={() => setView('setup')}
                className="admin-button"
              >
                System Setup
              </button>
              <button
                type="button"
                onClick={() => setView('certificates')}
                className="admin-button"
              >
                Back to Certificates
              </button>
            </div>

            <div className="certificate-alerts">
              <h3>Certificate Alerts</h3>
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Certificate</th>
                    <th>Expiration</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates
                    .filter(cert => {
                      const daysUntilExpiration = Math.ceil(
                        (new Date(cert.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
                      )
                      return daysUntilExpiration <= 30
                    })
                    .map(cert => {
                      const expirationDate = new Date(cert.expirationDate)
                      const today = new Date()
                      const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24))

                      let status = 'active'
                      if (daysUntilExpiration <= 0) status = 'expired'
                      else if (daysUntilExpiration <= 30) status = 'expiring'

                      return (
                        <tr key={cert._id}>
                          <td>{cert.staffMember}</td>
                          <td>{cert.certificateType}</td>
                          <td>{new Date(cert.expirationDate).toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge ${status}`}>
                              {status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => sendReminder(cert._id)}>
                              Send Reminder
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Setup View */}
        {view === 'setup' && (
          <div className="setup-dashboard">
            <h2>System Setup</h2>
            <div className="setup-header">
              <button
                onClick={() => setView('admin')}
                className="back-button"
              >
                Back to Dashboard
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
                className={`tab-button ${activeTab === 'employees' ? 'active' : ''}`}
                onClick={() => setActiveTab('employees')}
              >
                Employees
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
                  <ExcelTemplateUploader
                    token={token}
                    onSuccess={handleBulkUploadSuccess}
                    onError={handleBulkUploadError}
                  />
                </div>
              )}
              

              {/* Employees Tab */}
              {activeTab === 'employees' && (
                <div className="setup-section">
                  <h3>Manage Employees</h3>
                  <form onSubmit={handleEmployeeSubmit} className="setup-form">
                    <div className="form-group">
                      <label>Employee Name:</label>
                      <input type="text" name="name" required />
                    </div>
                    <div className="form-group">
                      <label>Position:</label>
                      <select name="position" required>
                        <option value="">Select Position</option>
                        {positions.map(pos => (
                          <option key={pos._id} value={pos._id}>
                            {pos.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Email:</label>
                      <input type="email" name="email" required />
                    </div>
                    <button type="submit">Add Employee</button>
                  </form>
                  <div className="setup-list">
                    {employees.map(emp => (
                      <div key={emp._id} className="list-item">
                        <span>{emp.name} - {emp.position?.title}</span>
                        <button
                          onClick={() => handleDelete('employee', emp._id)}
                          className="delete-button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Positions Tab */}
              {activeTab === 'positions' && (
                <div className="setup-section">
                  <h3>Manage Positions</h3>
                  <form onSubmit={handlePositionSubmit} className="setup-form">
                    <div className="form-group">
                      <label>Position Title:</label>
                      <input type="text" name="title" required />
                    </div>
                    <div className="form-group">
                      <label>Department:</label>
                      <input type="text" name="department" />
                    </div>
                    <button type="submit">Add Position</button>
                  </form>
                  <div className="setup-list">
                    {positions.map(pos => (
                      <div key={pos._id} className="list-item">
                        <span>{pos.title} - {pos.department}</span>
                        <button
                          onClick={() => handleDelete('position', pos._id)}
                          className="delete-button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certificate Types Tab */}
              {activeTab === 'certificateTypes' && (
                <div className="setup-section">
                  <h3>Manage Certificate Types</h3>
                  <form onSubmit={handleCertTypeSubmit} className="setup-form">
                    <div className="form-group">
                      <label>Certificate Name:</label>
                      <input type="text" name="name" required />
                    </div>
                    <div className="form-group">
                      <label>Validity Period (months):</label>
                      <input type="number" name="validityPeriod" min="1" required />
                    </div>
                    <div className="form-group">
                      <label>Description:</label>
                      <textarea name="description" />
                    </div>
                    <button type="submit">Add Certificate Type</button>
                  </form>
                  <div className="setup-list">
                    {certificateTypes.map(cert => (
                      <div key={cert._id} className="list-item">
                        <span>{cert.name} ({cert.validityPeriod} months)</span>
                        <button
                          onClick={() => handleDelete('certificateType', cert._id)}
                          className="delete-button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Certificates View */}
        {view === 'certificates' && (
          <>
            <form onSubmit={handleCertificateSubmit} className="form">
              <div className="form-group">
                <label>Staff Member:</label>
                <select
                  name="staffMember"
                  required
                  onChange={(e) => {
                    const selectedEmployeeId = e.target.value;
                    const employee = employees.find(emp => emp._id === selectedEmployeeId);
                    setSelectedEmployee(employee);
                    if (employee && employee.position) {
                      setSelectedPosition(employee.position.title);
                    }
                  }}
                >
                  <option value="">Select Staff Member</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Position:</label>
                <input
                  type="text"
                  name="position"
                  value={selectedPosition || 'Position will auto-fill based on selected employee'}
                  readOnly
                  className="readonly-input"
                />
              </div>
              <div className="form-group">
                <label>Certificate Type:</label>
                <select
                  name="certificateType"
                  required
                  onChange={(e) => {
                    const certType = certificateTypes.find(cert => cert._id === e.target.value);
                    if (certType && issueDate) {
                      const expiryDate = new Date(issueDate);
                      expiryDate.setMonth(expiryDate.getMonth() + certType.validityPeriod);
                      setExpiryDate(expiryDate.toISOString().split('T')[0]);
                    }
                  }}
                >
                  <option value="">Select Certificate Type</option>
                  {certificateTypes.map(cert => (
                    <option key={cert._id} value={cert._id}>
                      {cert.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Issue Date:</label>
                <input
                  type="date"
                  name="issueDate"
                  required
                  value={issueDate}
                  onChange={(e) => {
                    setIssueDate(e.target.value);
                    const selectedCertType = certificateTypes.find(
                      cert => cert._id === document.querySelector('select[name="certificateType"]').value
                    );
                    if (selectedCertType) {
                      const expiryDate = new Date(e.target.value);
                      expiryDate.setMonth(expiryDate.getMonth() + selectedCertType.validityPeriod);
                      setExpiryDate(expiryDate.toISOString().split('T')[0]);
                    }
                  }}
                />
              </div>
              <div className="form-group">
                <label>Expiration Date:</label>
                <input
                  type="date"
                  name="expirationDate"
                  value={expiryDate}
                  readOnly
                  className="readonly-input"
                />
              </div>
              <button type="submit">Submit Certificate</button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setView('admin')}
                  className="admin-button"
                >
                  View Admin Dashboard
                </button>
              )}
            </form>

            <div className="certificates-table">
              <h3>Submitted Certificates</h3>

              <div className="filter-controls">
                <div className="filter-group">
                  <label>Filter by Employee: </label>
                  <select
                    value={selectedFilterEmployee}
                    onChange={(e) => setSelectedFilterEmployee(e.target.value)}
                  >
                    <option value="">All Employees</option>
                    {[...new Set(certificates.map(cert => cert.staffMember))]
                      .sort()
                      .map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Filter by Certificate Type: </label>
                  <select
                    value={selectedFilterCertType}
                    onChange={(e) => setSelectedFilterCertType(e.target.value)}
                  >
                    <option value="">All Certificates</option>
                    {certificateTypes.map(type => (
                      <option key={type._id} value={type.name}>{type.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedFilterEmployee && (
                <div className="edit-controls">
                  <button
                    className="edit-details-button"
                    onClick={() => {
                      const employee = employees.find(emp => emp.name === selectedFilterEmployee);
                      setSelectedEmployeeForEdit(employee);
                      setView('employeeDetails');
                    }}
                  >
                    View/Edit {selectedFilterEmployee}'s Details
                  </button>
                </div>
              )}
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
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
                      (!selectedFilterCertType || cert.certificateType === selectedFilterCertType)
                    )
                    .map((cert) => {
                      const expirationDate = new Date(cert.expirationDate)
                      const today = new Date()
                      const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24))

                      let statusClass = 'status-active'
                      if (daysUntilExpiration <= 0) statusClass = 'status-expired'
                      else if (daysUntilExpiration <= 30) statusClass = 'status-expiring'

                      const position = positions.find(pos => pos._id === cert.position)

                      return (
                        <tr key={cert._id} className={statusClass}>
                          <td>{cert.staffMember}</td>
                          <td>{position ? position.title : cert.position}</td>
                          <td>{cert.certificateType}</td>
                          <td>{new Date(cert.issueDate).toLocaleDateString()}</td>
                          <td>{new Date(cert.expirationDate).toLocaleDateString()}</td>
                          <td>{cert.status}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {view === 'employeeDetails' && selectedEmployeeForEdit && (
          <div className="employee-details">
            <h2>Employee Details: {selectedEmployeeForEdit.name}</h2>
            <button
              onClick={() => setView('certificates')}
              className="back-button"
            >
              Back to Certificates
            </button>

            <div className="details-section">
              <h3>Personal Information</h3>
              <form onSubmit={handleEmployeeUpdate} className="form">
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    name="name"
                    value={selectedEmployeeForEdit.name}
                    onChange={(e) => setSelectedEmployeeForEdit({
                      ...selectedEmployeeForEdit,
                      name: e.target.value
                    })}
                  />
                </div>
                <div className="form-group">
                  <label>Position:</label>
                  <select
                    name="position"
                    value={selectedEmployeeForEdit.position?._id || ''}
                    onChange={(e) => setSelectedEmployeeForEdit({
                      ...selectedEmployeeForEdit,
                      position: positions.find(pos => pos._id === e.target.value)
                    })}
                  >
                    {positions.map(pos => (
                      <option key={pos._id} value={pos._id}>{pos.title}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={selectedEmployeeForEdit.email}
                    onChange={(e) => setSelectedEmployeeForEdit({
                      ...selectedEmployeeForEdit,
                      email: e.target.value
                    })}
                  />
                </div>
                <button type="submit">Update Employee</button>
              </form>
            </div>

            <div className="details-section">
              <h3>Certificates</h3>
              <table>
                <thead>
                  <tr>
                    <th>Certificate Type</th>
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

                      return (
                        <tr key={cert._id} className={statusClass}>
                          <td>{cert.certificateType}</td>
                          <td>{new Date(cert.issueDate).toLocaleDateString()}</td>
                          <td>{new Date(cert.expirationDate).toLocaleDateString()}</td>
                          <td>{cert.status}</td>
                          <td>
                            <button onClick={() => handleCertificateDelete(cert._id)}>Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App