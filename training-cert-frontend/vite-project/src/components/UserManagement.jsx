import { useState, useEffect } from 'react';

function UserManagement({ token, onBack }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resetTargetId, setResetTargetId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReset = async (userId) => {
    setError('');
    setMessage('');
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reset failed');
      setMessage(data.message);
      setResetTargetId(null);
      setNewPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-dashboard">
      <div className="setup-header">
        <h2>User Management</h2>
        <button onClick={onBack} className="back-button">
          Back to Administration
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {message && <div className="message">{message}</div>}

      <div className="setup-section">
        <div className="setup-section-header">
          <h3>User Accounts</h3>
          <p>Select a user to reset their password.</p>
        </div>

        <div className="setup-list">
          {users.length === 0 ? (
            <div className="empty-state">
              <p>No users found.</p>
            </div>
          ) : (
            users.map((user) => (
              <div key={user._id} className="list-item">
                <div className="item-info">
                  <span className="item-title">{user.username}</span>
                  <span className="item-subtitle">
                    {user.email} {user.isAdmin ? '· Admin' : '· User'}
                  </span>
                </div>

                <div className="employee-actions">
                  {resetTargetId === user._id ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleReset(user._id)}
                        disabled={loading}
                        className="add-button"
                        style={{ padding: '6px 14px' }}
                      >
                        {loading ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setResetTargetId(null); setNewPassword(''); setError(''); }}
                        className="back-button"
                        style={{ padding: '6px 14px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setResetTargetId(user._id); setNewPassword(''); setMessage(''); setError(''); }}
                      className="edit-button"
                    >
                      Reset Password
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default UserManagement;
