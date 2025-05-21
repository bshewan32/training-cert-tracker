import { useState, useEffect } from 'react';

const EmployeePositionDebugger = () => {
  const [token, setToken] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [requirementsData, setRequirementsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fixApplied, setFixApplied] = useState(false);

  // Step 1: Get token from localStorage
  useEffect(() => {
    // In a real app, you'd use your auth mechanism
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Step 2: Fetch employees when token is available
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!token) return;
      
      setLoading(true);
      try {
        const response = await fetch('https://training-cert-tracker.onrender.com/api/setup', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Setup data fetch failed: ${response.status}`);
        }
        
        const data = await response.json();
        setEmployees(data.employees || []);
      } catch (err) {
        setError(`Error fetching employees: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      fetchEmployees();
    }
  }, [token]);

  // Step 3: Fetch employee details when selected
  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      if (!selectedEmployee || !token) return;
      
      setLoading(true);
      try {
        // First get the employee details
        const response = await fetch(`https://training-cert-tracker.onrender.com/api/setup`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`Setup data fetch failed: ${response.status}`);
        }
        
        const setupData = await response.json();
        const employee = setupData.employees.find(emp => emp._id === selectedEmployee);
        
        setEmployeeDetails(employee);
        
        // Then try to get requirements
        try {
          const reqResponse = await fetch(`https://training-cert-tracker.onrender.com/api/positionRequirements/employee/${selectedEmployee}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!reqResponse.ok) {
            throw new Error(`Requirements fetch failed: ${reqResponse.status}`);
          }
          
          const reqData = await reqResponse.json();
          setRequirementsData(reqData);
        } catch (reqError) {
          // Don't fail the whole operation if requirements fetch fails
          setError(`Requirements fetch error: ${reqError.message}`);
        }
      } catch (err) {
        setError(`Error fetching employee details: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    if (selectedEmployee) {
      fetchEmployeeDetails();
    }
  }, [selectedEmployee, token]);

  // Apply the fix
  const applyFix = async () => {
    if (!selectedEmployee || !token) return;
    
    setLoading(true);
    try {
      // Get the employee
      const employee = employees.find(emp => emp._id === selectedEmployee);
      if (!employee) throw new Error("Employee not found");
      
      // Fix the positions array - ensure it contains valid position IDs
      const positions = Array.isArray(employee.positions) ? employee.positions : [];
      const validPositions = positions.map(pos => 
        typeof pos === 'object' ? pos._id : pos
      ).filter(Boolean);
      
      // Fix the primary position if needed
      let primaryPosition = employee.primaryPosition;
      if (!primaryPosition && validPositions.length > 0) {
        primaryPosition = validPositions[0];
      } else if (typeof primaryPosition === 'object') {
        primaryPosition = primaryPosition._id;
      }
      
      // Update the employee
      const updateResponse = await fetch(`https://training-cert-tracker.onrender.com/api/setup/employee/${selectedEmployee}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: employee.name,
          email: employee.email || '',
          positions: validPositions,
          primaryPosition: primaryPosition
        })
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update employee: ${updateResponse.status}`);
      }
      
      // Re-fetch the employee details
      const setupResponse = await fetch(`https://training-cert-tracker.onrender.com/api/setup`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!setupResponse.ok) {
        throw new Error(`Setup data fetch failed: ${setupResponse.status}`);
      }
      
      const setupData = await setupResponse.json();
      const updatedEmployee = setupData.employees.find(emp => emp._id === selectedEmployee);
      setEmployeeDetails(updatedEmployee);
      
      setFixApplied(true);
      
      // Try to fetch requirements again
      try {
        const reqResponse = await fetch(`https://training-cert-tracker.onrender.com/api/positionRequirements/employee/${selectedEmployee}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!reqResponse.ok) {
          throw new Error(`Requirements fetch failed after fix: ${reqResponse.status}`);
        }
        
        const reqData = await reqResponse.json();
        setRequirementsData(reqData);
        setError(''); // Clear previous errors
      } catch (reqError) {
        setError(`Requirements fetch error after fix: ${reqError.message}`);
      }
    } catch (err) {
      setError(`Error applying fix: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const setTokenManually = () => {
    if (tokenInput) {
      setToken(tokenInput);
      localStorage.setItem('authToken', tokenInput);
    }
  };

  const renderPositionInfo = () => {
    if (!employeeDetails) return null;
    
    const primaryPosition = employeeDetails.primaryPosition;
    let primaryPositionText = 'None';
    
    if (primaryPosition) {
      primaryPositionText = typeof primaryPosition === 'object' 
        ? `${primaryPosition.title} (${primaryPosition._id})` 
        : primaryPosition;
    }
    
    return (
      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-medium mb-2 text-gray-700">Position Information</h3>
        <p>
          <strong>Primary Position:</strong> {primaryPositionText}
        </p>
        
        <div className="mt-2">
          <strong>All Positions:</strong>
          {Array.isArray(employeeDetails.positions) && employeeDetails.positions.length > 0 ? (
            <ul className="list-disc ml-6 mt-1">
              {employeeDetails.positions.map((pos, idx) => (
                <li key={idx}>
                  {typeof pos === 'object' 
                    ? `${pos.title} (${pos._id})` 
                    : pos}
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic text-gray-500 mt-1">No positions assigned</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Employee Position Debugger</h1>
      
      {!token && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-2 text-yellow-700">No Token Found</h2>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Paste your JWT token" 
              className="flex-1 p-2 border border-gray-300 rounded"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button 
              onClick={setTokenManually}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Set Token
            </button>
          </div>
        </div>
      )}
      
      {loading && (
        <div className="text-center p-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {fixApplied && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700">Fix applied successfully!</p>
        </div>
      )}
      
      {token && employees.length > 0 && (
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">Select Employee:</label>
          <select 
            className="w-full p-2 border border-gray-300 rounded"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="">-- Select Employee --</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {employeeDetails && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Employee Details</h2>
          
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-medium mb-2 text-gray-700">Basic Information</h3>
            <p><strong>Name:</strong> {employeeDetails.name}</p>
            <p><strong>Email:</strong> {employeeDetails.email || 'Not specified'}</p>
            <p><strong>ID:</strong> {employeeDetails._id}</p>
          </div>
          
          {renderPositionInfo()}
          
          <div className="mb-4">
            <h3 className="font-medium mb-2 text-gray-700">Requirements API Response</h3>
            {requirementsData ? (
              <pre className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm overflow-auto max-h-60">
                {JSON.stringify(requirementsData, null, 2)}
              </pre>
            ) : (
              <p className="italic text-gray-500">No requirements data available</p>
            )}
          </div>
          
          <div className="flex justify-center">
            <button 
              onClick={applyFix}
              disabled={loading}
              className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              Apply Position Fix
            </button>
          </div>
        </div>
      )}
      
      <div className="mt-8 bg-blue-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2 text-blue-800">Debugging Instructions</h2>
        <ol className="list-decimal ml-6 space-y-2">
          <li>Select an employee from the dropdown to inspect their position data</li>
          <li>Review if the primary position and positions array look correct</li>
          <li>If you see issues (like missing primaryPosition or invalid position references), click "Apply Position Fix"</li>
          <li>The fix will update the employee record to ensure positions are properly formatted</li>
          <li>After applying the fix, try checking the employee requirements in your app</li>
        </ol>
      </div>
    </div>
  );
};

export default EmployeePositionDebugger;