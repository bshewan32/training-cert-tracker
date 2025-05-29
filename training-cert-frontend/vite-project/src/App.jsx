import { useState, useEffect } from 'react'
import './App.css'
import ExcelTemplateUploader from './components/ExcelTemplateUploader'
import ExcelExporter from './components/ExcelExporter'
import ExcelDateFormatter from './components/ExcelDateFormatter'
import PositionRequirements from './components/PositionRequirements'
import EmployeeRequirements from './components/EmployeeRequirements'
import EmployeeForm from './components/EmployeeForm'
import EmployeePositionsDashboard from './components/EmployeePositionsDashboard'
import MultiPositionComplianceDashboard from './components/MultiPositionComplianceDashboard'

// Import the new enhanced certificates component
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
      setError(err.message)
    }
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
  }
  
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
          >Logout</button>
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
              onClick={() => setView(view === 'login' ? 'register' : 'login')}>
              {view === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
            </button>
          </form>
        )}

        {/* Main Certificates View - Enhanced with Dashboard */}
        {view === 'certificates' && (
          <CertificatesWithDashboard
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
        )}

        {/* Employee Details View */}
        {view === 'employeeDetails' && selectedEmployeeForEdit && (
          <div className="employee-details">
            <div className="employee-details-header">
              <h2>Employee Details: {selectedEmployeeForEdit.name}</h2>
              <div className="header-actions">
                <button
                  onClick={() => setView('certificates')}
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
                    setMessage('Employee updated successfully');
                    await fetchSetupData(true);
                    setSelectedEmployeeForEdit(result);
                  } catch (err) {
                    setError(err.message);
                  }
                }}
                onCancel={() => setView('certificates')}
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

                        const position = positions.find(pos => pos._id === cert.position) || {}
                        const positionTitle = position.title || cert.position

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

        {/* Admin Dashboard View - Simplified */}
        {view === 'admin' && (
          <div className="admin-dashboard">
            <h2>Admin Dashboard</h2>

            <div className="admin-navigation">
              <button
                onClick={() => setView('certificates')}
                className="nav-button"
              >
                Back to Main Dashboard
              </button>
              <button
                onClick={() => setView('setup')}
                className="nav-button"
              >
                System Setup
              </button>
              <button
                onClick={() => setView('excelTools')}
                className="nav-button"
              >
                Excel Tools
              </button>
            </div>

            {/* Full Compliance Dashboard */}
            <MultiPositionComplianceDashboard token={token} />
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
                Back to Admin Dashboard
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
        
              {activeTab === 'employees' && (
                <div className="setup-section">
                  <h3>Manage Employees</h3>
                  
                  <div className="employee-management-header">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={showArchivedEmployees}
                        onChange={async (e) => {
                          const includeArchived = e.target.checked;
                          setShowArchivedEmployees(includeArchived);
                          await fetchSetupData(includeArchived);
                        }}
                      />
                      Show archived employees
                    </label>
                  </div>
                  
                  <EmployeeForm 
                    positions={positions}
                    token={token}
                    showArchiveControls={true}
                    onSubmit={async (employeeData) => {
                      try {
                        const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/employee', {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                          },
                          body: JSON.stringify(employeeData)
                        });
                        
                        if (!response.ok) throw new Error('Failed to add employee');
                        
                        setMessage('Employee added successfully');
                        await fetchSetupData(showArchivedEmployees);
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                    onCancel={() => {}}
                  />
                  
                  <div className="setup-list">
                    {employees.map(emp => (
                      <div key={emp._id} className={`list-item ${!emp.active ? 'archived-employee' : ''}`}>
                        <span className="employee-info">
                          {emp.name} - {emp.primaryPosition?.title || (emp.positions && emp.positions.length > 0 ? emp.positions[0].title : 'No position')}
                          {!emp.active && <span className="archived-badge">Archived</span>}
                        </span>
                        <div className="employee-actions">
                          <button
                            onClick={() => {
                              setSelectedEmployeeForEdit(emp);
                              setView('employeeDetails');
                            }}
                            className="edit-button"
                          >
                            Edit
                          </button>
                          
                          {emp.active ? (
                            <button
                              onClick={async () => {
                                if (confirm(`Archive ${emp.name}? They will be excluded from compliance calculations.`)) {
                                  try {
                                    const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${emp._id}/archive`, {
                                      method: 'PUT',
                                      headers: {
                                        'Authorization': `Bearer ${token}`
                                      }
                                    });
                                    if (!response.ok) throw new Error('Failed to archive employee');
                                    setMessage(`${emp.name} has been archived`);
                                    await fetchSetupData(showArchivedEmployees);
                                  } catch (err) {
                                    setError(err.message);
                                  }
                                }
                              }}
                              className="archive-button"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${emp._id}/reactivate`, {
                                    method: 'PUT',
                                    headers: {
                                      'Authorization': `Bearer ${token}`
                                    }
                                  });
                                  if (!response.ok) throw new Error('Failed to reactivate employee');
                                  setMessage(`${emp.name} has been reactivated`);
                                  await fetchSetupData(showArchivedEmployees);
                                } catch (err) {
                                  setError(err.message);
                                }
                              }}
                              className="reactivate-button"
                            >
                              Reactivate
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDelete('employee', emp._id)}
                            className="delete-button"
                          >
                            Remove
                          </button>
                        </div>
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
                        <div className="button-group">
                          <button
                            onClick={() => setSelectedPositionForRequirements(pos)}
                            className="manage-button"
                          >
                            Manage Requirements
                          </button>
                          <button
                            onClick={() => handleDelete('position', pos._id)}
                            className="delete-button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Add the Position Requirements component here */}
                  {selectedPositionForRequirements && (
                    <div className="requirements-section">
                      <PositionRequirements 
                        position={selectedPositionForRequirements}
                        token={token}
                        certificateTypes={certificateTypes}
                        onUpdate={() => {
                          fetchSetupData();
                        }}
                      />
                      <button
                        onClick={() => setSelectedPositionForRequirements(null)}
                        className="close-button"
                      >
                        Close Requirements
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Certificate Types Tab */}
              {activeTab === 'certificateTypes' && (
                <div className="setup-section">
                  <h3>Manage Certificate Types</h3>
                  <div className="cert-type-info">
                    <p><strong>Note:</strong> The validity period you set here will be used automatically when issuing certificates of this type.</p>
                  </div>
                  <form onSubmit={handleCertTypeSubmit} className="setup-form">
                    <div className="form-group">
                      <label>Certificate Name:</label>
                      <input type="text" name="name" required />
                    </div>
                    <div className="form-group">
                      <label>Validity Period (months):</label>
                      <input 
                        type="number" 
                        name="validityPeriod" 
                        min="1" 
                        max="120"
                        required 
                        placeholder="e.g., 12 for 1 year, 36 for 3 years"
                      />
                      <small className="validity-help">
                        Common periods: First Aid (36 months), CPR (12 months), Safety Training (24 months)
                      </small>
                    </div>
                    <div className="form-group">
                      <label>Description (Optional):</label>
                      <textarea name="description" placeholder="Brief description of this certificate type"></textarea>
                    </div>
                    <button type="submit">Add Certificate Type</button>
                  </form>
                  <div className="setup-list">
                    <h4>Existing Certificate Types</h4>
                    {certificateTypes.map(cert => (
                      <div key={cert._id} className="list-item cert-type-item">
                        <div className="cert-type-details">
                          <span className="cert-name">{cert.name}</span>
                          <span className="cert-validity">Valid for {cert.validityPeriod} months</span>
                          {cert.description && <span className="cert-description">{cert.description}</span>}
                        </div>
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

export default Appmessage || 'Error adding certificate');
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
      `}</style>
    </div>
  );
};

function App() {
  const [selectedFilterEmployee, setSelectedFilterEmployee] = useState('');
  const [selectedFilterCertType, setSelectedFilterCertType] = useState('');
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [selectedPositionForRequirements, setSelectedPositionForRequirements] = useState(null);
  const [activeExcelTool, setActiveExcelTool] = useState('exporter');
  const [view, setView] = useState('login')
  const [token, setToken] = useState(localStorage.getItem('authToken') || '')
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
  const [adminActiveTab, setAdminActiveTab] = useState('overview');
  const [showArchivedEmployees, setShowArchivedEmployees] = useState(false);

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
      localStorage.setItem('authToken', result.token)
      localStorage.setItem('isAdmin', result.isAdmin)
      setIsAdmin(result.isAdmin)
      setMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} successful!`)
      
      // Always go to certificates view for simplicity
      setView('certificates')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleLogout = () => {
    setToken('')
    localStorage.removeItem('authToken')
    localStorage.removeItem('isAdmin')
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
        fetchSetupData(true); // Always load archived employees for access
      }
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
      })
      if (!response.ok) throw new Error('Failed to fetch setup data')
      const data = await response.json()
      console.log('Setup data received:', data);
      console.log('Employees:', data.employees);
      setEmployees(data.employees)
      setPositions(data.positions)
      setCertificateTypes(data.certificateTypes)
    } catch (err) {
      console.error('Setup data fetch error:', err);
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

    console.log('Submitting employee data:', data);

    try {
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/employee', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      const result = await response.json();
      console.log('Server response:', result);

      if (!response.ok) throw new Error('Failed to add employee')
      await fetchSetupData()
      e.target.reset()
      setMessage('Employee added successfully')
    } catch (err) {
      console.error('Employee submit error:', err);
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

      {/* Add new hidden Excel Date Formatter view */}
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
            onClick={() => setView(view === 'login' ? 'register' : 'login')}>
            {view === 'login' ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </form>
      )}

      {/* Admin Dashboard View */}
{view === 'admin' && (
  <div className="admin-dashboard">
    <h2>Admin Dashboard</h2>

    {/* Admin Dashboard Tabs */}
    <div className="admin-tabs">
      <button
        className={`tab-button ${adminActiveTab === 'overview' ? 'active' : ''}`}
        onClick={() => setAdminActiveTab('overview')}
      >
        Overview
      </button>
      <button
        className={`tab-button ${adminActiveTab === 'positions' ? 'active' : ''}`}
        onClick={() => setAdminActiveTab('positions')}
      >
        Employee Positions
      </button>
      <button
        className={`tab-button ${adminActiveTab === 'compliance' ? 'active' : ''}`}
        onClick={() => setAdminActiveTab('compliance')}
      >
        Compliance
      </button>
      <button
        className={`tab-button ${adminActiveTab === 'certificates' ? 'active' : ''}`}
        onClick={() => setAdminActiveTab('certificates')}
      >
        Certificates
      </button>
    </div>
    
    {/* Tab content based on selected tab */}
    <div className="tab-content">
      {adminActiveTab === 'overview' && (
        <>
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
              onClick={() => setView('excelTools')}
              className="admin-button"
            >
              Excel Tools
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
                        <td>{cert.certificateName || cert.certificateType}</td>
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
        </>
      )}
      
      {adminActiveTab === 'positions' && (
        <EmployeePositionsDashboard token={token} />
      )}
      
      {adminActiveTab === 'compliance' && (
        <MultiPositionComplianceDashboard token={token} />
      )}
      
      {adminActiveTab === 'certificates' && (
        <div className="certificate-management">
          <h3>Certificate Management</h3>
          <p>View and manage all certificates across all positions.</p>
          
          <table>
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Position</th>
                <th>Certificate Type</th>
                <th>Issue Date</th>
                <th>Expiration Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => {
                const expirationDate = new Date(cert.expirationDate)
                const today = new Date()
                const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24))

                let statusClass = 'status-active'
                if (daysUntilExpiration <= 0) statusClass = 'status-expired'
                else if (daysUntilExpiration <= 30) statusClass = 'status-expiring'

                // Get position title
                const position = positions.find(pos => pos._id === cert.position) || {}
                const positionTitle = position.title || cert.position

                return (
                  <tr key={cert._id} className={statusClass}>
                    <td>{cert.staffMember}</td>
                    <td>{positionTitle}</td>
                    <td>{cert.certificateName || cert.certificateType}</td>
                    <td>{new Date(cert.issueDate).toLocaleDateString()}</td>
                    <td>{new Date(cert.expirationDate).toLocaleDateString()}</td>
                    <td>{cert.status}</td>
                    <td>
                      <button 
                        onClick={() => handleCertificateDelete(cert._id)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
)}

      {/* Dashboard View - New landing page for non-admin users */}
      {view === 'dashboard' && (
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h2>Certification Compliance Dashboard</h2>
            <div className="dashboard-nav">
              <button
                onClick={() => setView('certificates')}
                className="nav-button"
              >
                Add Certificates
              </button>
              {isAdmin && (
                <button
                  onClick={() => setView('admin')}
                  className="nav-button admin-button"
                >
                  Admin Dashboard
                </button>
              )}
            </div>
          </div>
          
          <MultiPositionComplianceDashboard token={token} />
          
          <style jsx>{`
            .dashboard-container {
              padding: 20px;
            }
            
            .dashboard-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 2px solid #e2e8f0;
            }
            
            .dashboard-header h2 {
              margin: 0;
              color: #1e293b;
              font-size: 1.75rem;
              font-weight: 600;
            }
            
            .dashboard-nav {
              display: flex;
              gap: 12px;
            }
            
            .nav-button {
              background-color: #3b82f6;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 10px 16px;
              font-weight: 500;
              cursor: pointer;
              transition: background-color 0.2s;
            }
            
            .nav-button:hover {
              background-color: #2563eb;
            }
            
            .admin-button {
              background-color: #dc2626;
            }
            
            .admin-button:hover {
              background-color: #b91c1c;
            }
            
            @media (max-width: 768px) {
              .dashboard-header {
                flex-direction: column;
                gap: 16px;
                align-items: stretch;
              }
              
              .dashboard-nav {
                justify-content: center;
              }
            }
          `}</style>
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
        
                    {activeTab === 'employees' && (
          <div className="setup-section">
            <h3>Manage Employees</h3>
            
            <div className="employee-management-header">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showArchivedEmployees}
                  onChange={async (e) => {
                    const includeArchived = e.target.checked;
                    setShowArchivedEmployees(includeArchived);
                    await fetchSetupData(includeArchived);
                  }}
                />
                Show archived employees
              </label>
            </div>
            
            <EmployeeForm 
              positions={positions}
              token={token}
              showArchiveControls={true}
              onSubmit={async (employeeData) => {
                try {
                  const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/employee', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(employeeData)
                  });
                  
                  if (!response.ok) throw new Error('Failed to add employee');
                  
                  setMessage('Employee added successfully');
                  await fetchSetupData(showArchivedEmployees);
                } catch (err) {
                  setError(err.message);
                }
              }}
              onCancel={() => {}}
            />
            
            <div className="setup-list">
              {employees.map(emp => (
                <div key={emp._id} className={`list-item ${!emp.active ? 'archived-employee' : ''}`}>
                  <span className="employee-info">
                    {emp.name} - {emp.primaryPosition?.title || (emp.positions && emp.positions.length > 0 ? emp.positions[0].title : 'No position')}
                    {!emp.active && <span className="archived-badge">Archived</span>}
                  </span>
                  <div className="employee-actions">
                    <button
                      onClick={() => {
                        setSelectedEmployeeForEdit(emp);
                        setView('employeeDetails');
                      }}
                      className="edit-button"
                    >
                      Edit
                    </button>
                    
                    {emp.active ? (
                      <button
                        onClick={async () => {
                          if (confirm(`Archive ${emp.name}? They will be excluded from compliance calculations.`)) {
                            try {
                              const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${emp._id}/archive`, {
                                method: 'PUT',
                                headers: {
                                  'Authorization': `Bearer ${token}`
                                }
                              });
                              if (!response.ok) throw new Error('Failed to archive employee');
                              setMessage(`${emp.name} has been archived`);
                              await fetchSetupData(showArchivedEmployees);
                            } catch (err) {
                              setError(err.message);
                            }
                          }
                        }}
                        className="archive-button"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${emp._id}/reactivate`, {
                              method: 'PUT',
                              headers: {
                                'Authorization': `Bearer ${token}`
                              }
                            });
                            if (!response.ok) throw new Error('Failed to reactivate employee');
                            setMessage(`${emp.name} has been reactivated`);
                            await fetchSetupData(showArchivedEmployees);
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                        className="reactivate-button"
                      >
                        Reactivate
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete('employee', emp._id)}
                      className="delete-button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


{/*             {/* Employees Tab */}
            {activeTab === 'employees' && (
              <div className="setup-section">
                <h3>Manage Employees</h3>
                <EmployeeForm 
                  positions={positions}
                  token={token}
                  onSubmit={async (employeeData) => {
                    try {
                      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup/employee', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(employeeData)
                      });
                      
                      if (!response.ok) throw new Error('Failed to add employee');
                      
                      setMessage('Employee added successfully');
                      await fetchSetupData();
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                  onCancel={() => {}}
                />
                <div className="setup-list">
                  {employees.map(emp => (
                    <div key={emp._id} className="list-item">
                      <span>{emp.name} - {emp.primaryPosition?.title || (emp.positions && emp.positions.length > 0 ? emp.positions[0].title : 'No position')}</span>
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
            )} */}

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
                      <div className="button-group">
                        <button
                          onClick={() => setSelectedPositionForRequirements(pos)}
                          className="manage-button"
                        >
                          Manage Requirements
                        </button>
                        <button
                          onClick={() => handleDelete('position', pos._id)}
                          className="delete-button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Add the Position Requirements component here */}
                {selectedPositionForRequirements && (
                  <div className="requirements-section">
                    <PositionRequirements 
                      position={selectedPositionForRequirements}
                      token={token}
                      certificateTypes={certificateTypes}
                      onUpdate={() => {
                        // This will refresh data after requirements are updated
                        fetchSetupData();
                      }}
                    />
                    <button
                      onClick={() => setSelectedPositionForRequirements(null)}
                      className="close-button"
                    >
                      Close Requirements
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Certificate Types Tab */}
            {/* Certificate Types Tab */}
            {activeTab === 'certificateTypes' && (
              <div className="setup-section">
                <h3>Manage Certificate Types</h3>
                <div className="cert-type-info">
                  <p><strong>Note:</strong> The validity period you set here will be used automatically when issuing certificates of this type.</p>
                </div>
                <form onSubmit={handleCertTypeSubmit} className="setup-form">
                  <div className="form-group">
                    <label>Certificate Name:</label>
                    <input type="text" name="name" required />
                  </div>
                  <div className="form-group">
                    <label>Validity Period (months):</label>
                    <input 
                      type="number" 
                      name="validityPeriod" 
                      min="1" 
                      max="120"
                      required 
                      placeholder="e.g., 12 for 1 year, 36 for 3 years"
                    />
                    <small className="validity-help">
                      Common periods: First Aid (36 months), CPR (12 months), Safety Training (24 months)
                    </small>
                  </div>
                  <div className="form-group">
                    <label>Description (Optional):</label>
                    <textarea name="description" placeholder="Brief description of this certificate type"></textarea>
                  </div>
                  <button type="submit">Add Certificate Type</button>
                </form>
                <div className="setup-list">
                  <h4>Existing Certificate Types</h4>
                  {certificateTypes.map(cert => (
                    <div key={cert._id} className="list-item cert-type-item">
                      <div className="cert-type-details">
                        <span className="cert-name">{cert.name}</span>
                        <span className="cert-validity">Valid for {cert.validityPeriod} months</span>
                        {cert.description && <span className="cert-description">{cert.description}</span>}
                      </div>
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
        <div className="certificates-header">
            <h2>Add New Certificate</h2>
            <div className="certificates-nav">
              <button
                onClick={() => setView('dashboard')}
                className="nav-button"
              >
                View Dashboard
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setView('admin')}
                  className="nav-button admin-button"
                >
                  Admin Dashboard
                </button>
              )}
            </div>
          </div>
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
                      
                      // Auto-populate primary position or first position
                      if (employee) {
                        if (employee.primaryPosition) {
                          setSelectedPosition(employee.primaryPosition._id || employee.primaryPosition);
                        } else if (employee.positions && employee.positions.length > 0) {
                          setSelectedPosition(employee.positions[0]._id);
                        } else {
                          setSelectedPosition('');
                        }
                      } else {
                        setSelectedPosition('');
                      }
                    }}
                  >
                    <option value="">Select Staff Member</option>
                    {employees
                      .filter(emp => emp.active) // Only show active employees in certificate form
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(emp => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name}
                        </option>
                      ))}
                  </select>
                </div>
{/*             <div className="form-group">
              <label>Staff Member:</label>
              <select
                name="staffMember"
                required
                onChange={(e) => {
                  const selectedEmployeeId = e.target.value;
                  const employee = employees.find(emp => emp._id === selectedEmployeeId);
                  setSelectedEmployee(employee);
                  
                  // Auto-populate primary position or first position
                  if (employee) {
                    if (employee.primaryPosition) {
                      setSelectedPosition(employee.primaryPosition._id || employee.primaryPosition);
                    } else if (employee.positions && employee.positions.length > 0) {
                      setSelectedPosition(employee.positions[0]._id);
                    } else {
                      setSelectedPosition('');
                    }
                  } else {
                    setSelectedPosition('');
                  }
                }}
              >
                <option value="">Select Staff Member</option>
                {employees
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
              </select>
            </div> */}
            
            <div className="form-group">
              <label>Position:</label>
              {selectedEmployee && selectedEmployee.positions && selectedEmployee.positions.length > 1 ? (
                // Show dropdown if employee has multiple positions
                <select
                  name="position"
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  required
                >
                  <option value="">Select Position</option>
                  {selectedEmployee.positions.map(pos => (
                    <option key={pos._id} value={pos._id}>
                      {pos.title} {pos._id === (selectedEmployee.primaryPosition?._id || selectedEmployee.primaryPosition) ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
              ) : selectedEmployee && selectedEmployee.positions && selectedEmployee.positions.length === 1 ? (
                // Show read-only field if employee has only one position
                <input
                  type="text"
                  name="position"
                  value={selectedEmployee.positions[0].title}
                  readOnly
                  className="readonly-input"
                />
              ) : (
                // Show placeholder text if no employee selected
                <input
                  type="text"
                  name="position"
                  value={selectedPosition ? positions.find(p => p._id === selectedPosition)?.title || '' : 'Select staff member first'}
                  readOnly
                  className="readonly-input"
                />
              )}
            </div>
            
            <div className="form-group">
              <label>Certificate Type:</label>
              <select
                name="certificateType"
                required
                onChange={(e) => {
                  const certType = certificateTypes.find(cert => cert._id === e.target.value);
                  console.log('Selected certificate type:', certType); // Debug log
                  
                  if (certType && issueDate) {
                    const expiryDate = new Date(issueDate);
                    expiryDate.setMonth(expiryDate.getMonth() + (certType.validityPeriod || 12));
                    setExpiryDate(expiryDate.toISOString().split('T')[0]);
                    console.log(`Calculated expiry: ${certType.validityPeriod || 12} months from ${issueDate}`); // Debug log
                  } else if (certType) {
                    // Store the certificate type for later calculation when issue date is set
                    console.log('Certificate type selected, waiting for issue date');
                  }
                }}
              >
                <option value="">Select Certificate Type</option>
                {certificateTypes
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(cert => (
                    <option key={cert._id} value={cert._id}>
                      {cert.name} ({cert.validityPeriod || 12} months)
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
                  
                  // Find the currently selected certificate type
                  const selectedCertTypeId = document.querySelector('select[name="certificateType"]')?.value;
                  const selectedCertType = certificateTypes.find(cert => cert._id === selectedCertTypeId);
                  
                  console.log('Issue date changed:', e.target.value); // Debug log
                  console.log('Selected cert type for calculation:', selectedCertType); // Debug log
                  
                  if (selectedCertType && e.target.value) {
                    const expiryDate = new Date(e.target.value);
                    expiryDate.setMonth(expiryDate.getMonth() + (selectedCertType.validityPeriod || 12));
                    setExpiryDate(expiryDate.toISOString().split('T')[0]);
                    console.log(`Calculated expiry: ${selectedCertType.validityPeriod || 12} months from ${e.target.value}`); // Debug log
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
                title="Automatically calculated based on certificate type validity period"
              />
              <small className="expiry-note">
                Automatically calculated based on certificate type's validity period
              </small>
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
                onClick={async () => {
                  try {
                    let employee = employees.find(emp => emp.name === selectedFilterEmployee);
                    
                    if (!employee) {
                      await fetchSetupData(true);
                      employee = employees.find(emp => emp.name === selectedFilterEmployee);
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
                    (!selectedFilterCertType || (cert.certificateName || cert.certificateType) === selectedFilterCertType)
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
                        <td>{cert.certificateName || cert.certificateType}</td>
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
    <div className="employee-details-header">
      <h2>Employee Details: {selectedEmployeeForEdit.name}</h2>
      <div className="header-actions">
        <button
          onClick={() => setView('certificates')}
          className="back-button"
        >
          Back to Certificates
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
              <h3>Personal Information</h3>
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
                    setMessage('Employee updated successfully');
                    await fetchSetupData(true);
                    setSelectedEmployeeForEdit(result);
                  } catch (err) {
                    setError(err.message);
                  }
                }}
                onCancel={() => setView('certificates')}
              />
            </div>
        
            <div className="details-section">
              <h3>Certificates</h3>
              {selectedEmployeeForEdit.active === false && (
                <div className="archived-employee-note">
                  <p><strong>Note:</strong> This employee is archived, but you can still view their certificate history.</p>
                </div>
              )}
              
              <table>
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
        
                      const position = positions.find(pos => pos._id === cert.position) || {}
                      const positionTitle = position.title || cert.position
        
                      return (
                        <tr key={cert._id} className={statusClass}>
                          <td>{cert.certificateName || cert.certificateType}</td>
                          <td>{positionTitle}</td>
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

export default App
