// NotificationControl.jsx
// Add this component to your admin dashboard

import React, { useState } from 'react';

const NotificationControl = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState(null);
  const [daysThreshold, setDaysThreshold] = useState(60);
  const [testEmail, setTestEmail] = useState('');

  // Get preview of certificates that will receive notifications
  const handlePreview = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/notifications/preview?days=${daysThreshold}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to get preview');
      
      const data = await response.json();
      setPreview(data);
      setShowPreview(true);
    } catch (error) {
      alert('Error getting preview: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Send notifications to all expiring certificates
  const handleSendNotifications = async () => {
    if (!confirm(`Send email notifications to ${preview?.count || 'all'} employees with expiring certificates?`)) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ daysThreshold })
      });
      
      if (!response.ok) throw new Error('Failed to send notifications');
      
      const data = await response.json();
      setResult(data);
      setShowPreview(false);
      alert(`✓ Notifications sent!\n\nEmails sent: ${data.stats.emailsSent}\nFailed: ${data.stats.emailsFailed}\nNo email: ${data.stats.noEmailCount}`);
    } catch (error) {
      alert('Error sending notifications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Send test email
  const handleTestEmail = async () => {
    if (!testEmail) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: testEmail })
      });
      
      if (!response.ok) throw new Error('Failed to send test email');
      
      alert('✓ Test email sent! Check your inbox.');
    } catch (error) {
      alert('Error sending test email: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notification-control" style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📧 Email Notifications</h3>
        <p style={styles.subtitle}>Send expiration reminders to employees</p>
      </div>

      {/* Threshold Selector */}
      <div style={styles.section}>
        <label style={styles.label}>
          Notification Window:
          <select 
            value={daysThreshold} 
            onChange={(e) => setDaysThreshold(parseInt(e.target.value))}
            style={styles.select}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days (recommended)</option>
            <option value={90}>90 days</option>
          </select>
        </label>
        <p style={styles.helpText}>
          Certificates expiring within this window will receive notifications
        </p>
      </div>

      {/* Action Buttons */}
      <div style={styles.buttonGroup}>
        <button 
          onClick={handlePreview}
          disabled={loading}
          style={styles.previewButton}
        >
          {loading ? '⏳ Loading...' : '👁️ Preview Recipients'}
        </button>
        
        <button 
          onClick={handleSendNotifications}
          disabled={loading || !preview}
          style={{
            ...styles.sendButton,
            opacity: (!preview || loading) ? 0.5 : 1,
            cursor: (!preview || loading) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '⏳ Sending...' : '📤 Send Notifications'}
        </button>
      </div>

      {/* Preview Results */}
      {showPreview && preview && (
        <div style={styles.previewBox}>
          <h4 style={styles.previewTitle}>
            📋 {preview.count} Certificate{preview.count !== 1 ? 's' : ''} Expiring Soon
          </h4>
          
          {preview.count === 0 ? (
            <p style={styles.noResults}>✓ No certificates expiring within {daysThreshold} days</p>
          ) : (
            <div style={styles.certificateList}>
              {preview.certificates.slice(0, 10).map((cert, index) => (
                <div key={cert.id} style={styles.certificateItem}>
                  <span style={styles.certName}>{cert.staffMember}</span>
                  <span style={styles.certType}>{cert.certType}</span>
                  <span style={{
                    ...styles.certDays,
                    color: cert.daysUntilExpiry <= 7 ? '#dc2626' : 
                           cert.daysUntilExpiry <= 14 ? '#f59e0b' : '#3b82f6'
                  }}>
                    {cert.daysUntilExpiry} days
                  </span>
                </div>
              ))}
              {preview.count > 10 && (
                <p style={styles.moreText}>...and {preview.count - 10} more</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test Email Section */}
      <div style={styles.testSection}>
        <h4 style={styles.testTitle}>🧪 Test Email Configuration</h4>
        <div style={styles.testInputGroup}>
          <input
            type="email"
            placeholder="your@email.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            style={styles.testInput}
          />
          <button 
            onClick={handleTestEmail}
            disabled={loading}
            style={styles.testButton}
          >
            Send Test
          </button>
        </div>
      </div>

      {/* Status Message */}
      {result && (
        <div style={styles.resultBox}>
          <p style={styles.resultText}>
            ✅ Notifications sent successfully!
          </p>
          <div style={styles.stats}>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Sent:</span>
              <span style={styles.statValue}>{result.stats.emailsSent}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Failed:</span>
              <span style={styles.statValue}>{result.stats.emailsFailed}</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>No Email:</span>
              <span style={styles.statValue}>{result.stats.noEmailCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    margin: '20px 0'
  },
  header: {
    marginBottom: '20px',
    borderBottom: '2px solid #e5e7eb',
    paddingBottom: '16px'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '1.5rem',
    color: '#111827'
  },
  subtitle: {
    margin: 0,
    color: '#6b7280',
    fontSize: '0.95rem'
  },
  section: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  },
  select: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '1rem',
    marginTop: '8px'
  },
  helpText: {
    margin: '8px 0 0 0',
    fontSize: '0.85rem',
    color: '#6b7280'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px'
  },
  previewButton: {
    flex: 1,
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  sendButton: {
    flex: 1,
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  previewBox: {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px',
    border: '1px solid #e5e7eb'
  },
  previewTitle: {
    margin: '0 0 16px 0',
    color: '#374151'
  },
  noResults: {
    color: '#10b981',
    margin: 0
  },
  certificateList: {
    maxHeight: '300px',
    overflowY: 'auto'
  },
  certificateItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px',
    background: 'white',
    borderRadius: '6px',
    marginBottom: '8px',
    border: '1px solid #e5e7eb'
  },
  certName: {
    fontWeight: '600',
    color: '#111827',
    flex: 1
  },
  certType: {
    color: '#6b7280',
    flex: 1,
    textAlign: 'center'
  },
  certDays: {
    fontWeight: '600',
    textAlign: 'right',
    flex: '0 0 80px'
  },
  moreText: {
    textAlign: 'center',
    color: '#6b7280',
    fontStyle: 'italic',
    margin: '8px 0 0 0'
  },
  testSection: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '20px',
    marginTop: '20px'
  },
  testTitle: {
    margin: '0 0 12px 0',
    color: '#374151',
    fontSize: '1.1rem'
  },
  testInputGroup: {
    display: 'flex',
    gap: '8px'
  },
  testInput: {
    flex: 1,
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #d1d5db',
    fontSize: '1rem'
  },
  testButton: {
    padding: '10px 20px',
    background: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer'
  },
  resultBox: {
    background: '#d1fae5',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '20px',
    border: '1px solid #10b981'
  },
  resultText: {
    margin: '0 0 12px 0',
    color: '#065f46',
    fontWeight: '600'
  },
  stats: {
    display: 'flex',
    gap: '20px'
  },
  statItem: {
    display: 'flex',
    gap: '8px'
  },
  statLabel: {
    color: '#065f46'
  },
  statValue: {
    fontWeight: '700',
    color: '#047857'
  }
};

export default NotificationControl;