import { useState, useEffect } from 'react';
import './RenewalModal.css';

const RenewalModal = ({ certificate, token, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    issueDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    notes: 'Annual Renewal'
  });
  const [certificateFile, setCertificateFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-calculate expiry (you can adjust this based on your cert type validity)
  useEffect(() => {
    if (formData.issueDate) {
      const issue = new Date(formData.issueDate);
      const expiry = new Date(issue);
      // Default to 12 months - you can make this dynamic based on cert type
      expiry.setMonth(expiry.getMonth() + 12);
      setFormData(prev => ({
        ...prev,
        expirationDate: expiry.toISOString().split('T')[0]
      }));
    }
  }, [formData.issueDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('issueDate', formData.issueDate);
      formDataToSend.append('expirationDate', formData.expirationDate);
      formDataToSend.append('notes', formData.notes);
      
      if (certificateFile) {
        formDataToSend.append('file', certificateFile);
      }

      const response = await fetch(
        `https://training-cert-tracker.onrender.com/api/certificates/${certificate._id}/renew`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formDataToSend
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to renew certificate');
      }

      const result = await response.json();
      alert('Certificate renewed successfully!');
      onSuccess(result.certificate);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Renew Certificate</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="cert-info">
          <p><strong>Employee:</strong> {certificate.staffMember}</p>
          <p><strong>Certificate:</strong> {certificate.certType || certificate.certificateType}</p>
          <p><strong>Current Expiry:</strong> {new Date(certificate.expirationDate).toLocaleDateString()}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Issue Date:</label>
            <input
              type="date"
              value={formData.issueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label>New Expiration Date:</label>
            <input
              type="date"
              value={formData.expirationDate}
              onChange={(e) => setFormData(prev => ({ ...prev, expirationDate: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label>Upload New Certificate (Optional):</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setCertificateFile(e.target.files[0])}
            />
            {certificateFile && (
              <div className="file-selected">
                Selected: {certificateFile.name}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes:</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g., Annual renewal, Updated certification"
            />
          </div>

          <div className="modal-actions">
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Renewing...' : '✓ Renew Certificate'}
            </button>
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenewalModal;