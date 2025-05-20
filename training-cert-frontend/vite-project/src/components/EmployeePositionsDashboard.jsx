import { useState, useEffect } from 'react';

const EmployeePositionsDashboard = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalPositions: 0,
    avgPositionsPerEmployee: 0,
    multiPositionEmployees: 0,
    percentMultiPosition: 0
  });
  
  // Filtering
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [showOnlyMultiPosition, setShowOnlyMultiPosition] = useState(false);
  
  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [token]);
  
  // Calculate stats when employee or position data changes
  useEffect(() => {
    if (employees.length > 0) {
      // Count employees with multiple positions
      const multiPositionCount = employees.filter(emp => 
        emp.positions && emp.positions.length > 1
      ).length;
      
      // Calculate average positions per employee
      const totalPositionsAssigned = employees.reduce((sum, emp) => 
        sum + (emp.positions ? emp.positions.length : 0), 0
      );
      
      const avgPositions = employees.length > 0 
        ? (totalPositionsAssigned / employees.length).toFixed(1) 
        : 0;
      
      // Update stats
      setStats({
        totalEmployees: employees.length,
        totalPositions: positions.length,
        avgPositionsPerEmployee: avgPositions,
        multiPositionEmployees: multiPositionCount,
        percentMultiPosition: employees.length > 0 
          ? Math.round((multiPositionCount / employees.length) * 100) 
          : 0
      });
    }
  }, [employees, positions]);
  
  // Fetch employees and positions data
  const fetchData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch setup data
      const response = await fetch('https://training-cert-tracker.onrender.com/api/setup', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const data = await response.json();
      
      setEmployees(data.employees || []);
      setPositions(data.positions || []);
    } catch (err) {
      setError(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };
  
  // Get all departments from positions
  const departments = ['all', ...new Set(positions
    .map(pos => pos.department)
    .filter(Boolean)
  )];
  
  // Filter employees based on selected filters
  const filteredEmployees = employees.filter(employee => {
    // Filter by multi-position status
    if (showOnlyMultiPosition && (!employee.positions || employee.positions.length <= 1)) {
      return false;
    }
    
    // Filter by department
    if (filterDepartment !== 'all') {
      // Check if any of the employee's positions are in the selected department
      const employeePositions = employee.positions || [];
      const positionsInDepartment = employeePositions.filter(posId => {
        const position = positions.find(p => p._id === (typeof posId === 'object' ? posId._id : posId));
        return position && position.department === filterDepartment;
      });
      
      if (positionsInDepartment.length === 0) {
        return false;
      }
    }
    
    return true;
  });
  
  // Get position title from ID
  const getPositionTitle = (positionId) => {
    const position = positions.find(pos => pos._id === (typeof positionId === 'object' ? positionId._id : positionId));
    return position ? position.title : 'Unknown Position';
  };
  
  // Get position department from ID
  const getPositionDepartment = (positionId) => {
    const position = positions.find(pos => pos._id === (typeof positionId === 'object' ? positionId._id : positionId));
    return position ? (position.department || 'No Department') : 'Unknown';
  };
  
  // Format percentage for display
  const formatPercent = (percent) => {
    return `${percent}%`;
  };
  
  return (
    <div className="employee-positions-dashboard">
      <h2>Employee Positions Dashboard</h2>
      
      {loading ? (
        <div className="loading-indicator">Loading data...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="stat-cards">
            <div className="stat-card">
              <h3>Total Employees</h3>
              <div className="stat-value">{stats.totalEmployees}</div>
            </div>
            
            <div className="stat-card">
              <h3>Total Positions</h3>
              <div className="stat-value">{stats.totalPositions}</div>
            </div>
            
            <div className="stat-card">
              <h3>Avg. Positions per Employee</h3>
              <div className="stat-value">{stats.avgPositionsPerEmployee}</div>
            </div>
            
            <div className="stat-card">
              <h3>Multi-Position Employees</h3>
              <div className="stat-value">
                {stats.multiPositionEmployees}
                <span className="stat-percentage">
                  ({formatPercent(stats.percentMultiPosition)})
                </span>
              </div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="filter-controls">
            <div className="filter-group">
              <label>Department:</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.filter(dept => dept !== 'all').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group checkbox">
              <input
                type="checkbox"
                id="multiPositionOnly"
                checked={showOnlyMultiPosition}
                onChange={(e) => setShowOnlyMultiPosition(e.target.checked)}
              />
              <label htmlFor="multiPositionOnly">Show only multi-position employees</label>
            </div>
          </div>
          
          {/* Employee Positions Table */}
          <div className="table-container">
            <table className="employee-positions-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Total Positions</th>
                  <th>Primary Position</th>
                  <th>All Positions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="no-results">No employees match the selected filters</td>
                  </tr>
                ) : (
                  filteredEmployees.map(employee => (
                    <tr key={employee._id} className={
                      (employee.positions && employee.positions.length > 1) ? 'multi-position' : ''
                    }>
                      <td>{employee.name}</td>
                      <td>{employee.email || '-'}</td>
                      <td className="positions-count">
                        {employee.positions ? employee.positions.length : 0}
                      </td>
                      <td>
                        {employee.primaryPosition ? (
                          <div className="position-tag primary">
                            <span className="position-title">
                              {getPositionTitle(employee.primaryPosition)}
                            </span>
                            <span className="position-department">
                              {getPositionDepartment(employee.primaryPosition)}
                            </span>
                          </div>
                        ) : (
                          <span className="no-position">No primary position</span>
                        )}
                      </td>
                      <td>
                        {employee.positions && employee.positions.length > 0 ? (
                          <div className="position-tags">
                            {employee.positions.map(posId => {
                              const isPrimary = employee.primaryPosition && 
                                (typeof employee.primaryPosition === 'object' 
                                  ? employee.primaryPosition._id === (typeof posId === 'object' ? posId._id : posId)
                                  : employee.primaryPosition === (typeof posId === 'object' ? posId._id : posId));
                              
                              return (
                                <div 
                                  key={typeof posId === 'object' ? posId._id : posId} 
                                  className={`position-tag ${isPrimary ? 'primary' : 'secondary'}`}
                                >
                                  <span className="position-title">
                                    {getPositionTitle(posId)}
                                  </span>
                                  <span className="position-department">
                                    {getPositionDepartment(posId)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="no-position">No positions assigned</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      
      <style jsx>{`
        .employee-positions-dashboard {
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
        
        .stat-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .stat-card {
          background-color: #f7fafc;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
        
        .stat-card h3 {
          color: #4a5568;
          font-size: 0.9rem;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 10px;
        }
        
        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          color: #2c5282;
        }
        
        .stat-percentage {
          font-size: 1rem;
          color: #4a5568;
          margin-left: 5px;
        }
        
        .filter-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin-bottom: 20px;
          align-items: center;
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
          white-space: nowrap;
        }
        
        .filter-group select {
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 0.9rem;
          min-width: 200px;
        }
        
        .filter-group.checkbox {
          gap: 5px;
        }
        
        .filter-group.checkbox input {
          width: 16px;
          height: 16px;
        }
        
        .table-container {
          overflow-x: auto;
          margin-top: 20px;
        }
        
        .employee-positions-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .employee-positions-table th {
          text-align: left;
          padding: 12px 15px;
          background-color: #edf2f7;
          color: #4a5568;
          font-weight: 600;
          border-bottom: 2px solid #cbd5e0;
        }
        
        .employee-positions-table td {
          padding: 12px 15px;
          border-bottom: 1px solid #e2e8f0;
          color: #2d3748;
        }
        
        .employee-positions-table tr.multi-position {
          background-color: #ebf8ff;
        }
        
        .employee-positions-table tr:hover {
          background-color: #f7fafc;
        }
        
        .positions-count {
          text-align: center;
          font-weight: 600;
        }
        
        .no-results {
          text-align: center;
          color: #a0aec0;
          font-style: italic;
          padding: 30px 0;
        }
        
        .no-position {
          color: #a0aec0;
          font-style: italic;
        }
        
        .position-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .position-tag {
          display: flex;
          flex-direction: column;
          padding: 6px 10px;
          border-radius: 4px;
          background-color: #e2e8f0;
          font-size: 0.85rem;
        }
        
        .position-tag.primary {
          background-color: #bee3f8;
          border-left: 3px solid #3182ce;
        }
        
        .position-tag.secondary {
          background-color: #e2e8f0;
        }
        
        .position-title {
          font-weight: 600;
          color: #2c5282;
        }
        
        .position-department {
          font-size: 0.75rem;
          color: #4a5568;
          margin-top: 2px;
        }
        
        @media (max-width: 768px) {
          .stat-cards {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .filter-controls {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .filter-group {
            width: 100%;
          }
          
          .filter-group select {
            flex: 1;
          }
          
          .employee-positions-table th:nth-child(2),
          .employee-positions-table td:nth-child(2) {
            display: none; /* Hide email column on mobile */
          }
        }
      `}</style>
    </div>
  );
};

export default EmployeePositionsDashboard;