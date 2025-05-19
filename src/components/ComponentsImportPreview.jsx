// components/ImportPreview.jsx
import { useState, useEffect } from 'react';
import { Check, AlertTriangle, X } from 'lucide-react';

const ImportPreview = ({ data, onConfirm, onCancel }) => {
  const [previewData, setPreviewData] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    valid: 0,
    issues: 0
  });

  useEffect(() => {
    if (data && data.length > 0) {
      // Set the preview data
      setPreviewData(data.slice(0, 10)); // Show first 10 rows
      
      // Calculate stats
      const validRows = data.filter(row => !row.hasIssues).length;
      setStats({
        total: data.length,
        valid: validRows,
        issues: data.length - validRows
      });
    }
  }, [data]);

  // Handle confirmation with possibly filtered data
  const handleConfirm = () => {
    onConfirm(data.filter(row => !row.hasIssues));
  };

  return (
    <div className="import-preview">
      <div className="preview-header">
        <h3>Review Import Data</h3>
        <div className="preview-stats">
          <div className="stat-item">
            <span className="stat-label">Total Records:</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Valid Records:</span>
            <span className="stat-value success">{stats.valid}</span>
          </div>
          {stats.issues > 0 && (
            <div className="stat-item">
              <span className="stat-label">Issues:</span>
              <span className="stat-value warning">{stats.issues}</span>
            </div>
          )}
        </div>
      </div>

      <div className="preview-table-container">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>Position</th>
              <th>Certificate</th>
              <th>Issue Date</th>
              <th>Expiry Date</th>
              <th>Email</th>
              <th>Issues</th>
            </tr>
          </thead>
          <tbody>
            {previewData.map((row, index) => (
              <tr key={index} className={row.hasIssues ? 'has-issues' : ''}>
                <td>
                  {row.hasIssues ? (
                    <span className="status-icon warning">
                      <AlertTriangle size={16} />
                    </span>
                  ) : (
                    <span className="status-icon success">
                      <Check size={16} />
                    </span>
                  )}
                </td>
                <td>{row.Name || '-'}</td>
                <td>{row['Position Title'] || '-'}</td>
                <td>{row.Type || '-'}</td>
                <td>{row['Booking Date'] || '-'}</td>
                <td>{row['Expiry Date'] || 'Auto-calculated'}</td>
                <td>{row.Company || '-'}</td>
                <td>
                  {row.issues && row.issues.length > 0 ? (
                    <ul className="issues-list">
                      {row.issues.map((issue, i) => (
                        <li key={i} className="issue-item">{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {data.length > 10 && (
          <div className="preview-note">
            Showing 10 of {data.length} records. All {stats.valid} valid records will be imported.
          </div>
        )}
      </div>

      <div className="preview-actions">
        <button
          onClick={onCancel}
          className="cancel-button"
        >
          Cancel
        </button>
        
        <button
          onClick={handleConfirm}
          className="confirm-button"
          disabled={stats.valid === 0}
        >
          {stats.issues > 0 
            ? `Import ${stats.valid} Valid Records` 
            : 'Import All Records'}
        </button>
      </div>

      <style jsx>{`
        .import-preview {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 20px;
          max-width: 100%;
          overflow: hidden;
        }
        
        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .preview-header h3 {
          margin: 0;
          color: #1e293b;
        }
        
        .preview-stats {
          display: flex;
          gap: 16px;
        }
        
        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .stat-label {
          font-weight: 500;
          color: #64748b;
        }
        
        .stat-value {
          font-weight: 600;
          color: #0f172a;
        }
        
        .stat-value.success {
          color: #16a34a;
        }
        
        .stat-value.warning {
          color: #ea580c;
        }
        
        .preview-table-container {
          overflow-x: auto;
          margin-bottom: 20px;
        }
        
        .preview-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .preview-table th {
          background-color: #f8fafc;
          padding: 12px 16px;
          text-align: left;
          color: #475569;
          font-weight: 600;
          border-bottom: 2px solid #e2e8f0;
        }
        
        .preview-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          color: #1e293b;
        }
        
        .preview-table tr.has-issues td {
          background-color: #fff7ed;
        }
        
        .status-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .status-icon.success {
          color: #16a34a;
        }
        
        .status-icon.warning {
          color: #ea580c;
        }
        
        .issues-list {
          margin: 0;
          padding-left: 20px;
          font-size: 0.875rem;
          color: #b91c1c;
        }
        
        .issue-item {
          margin-bottom: 4px;
        }
        
        .preview-note {
          margin-top: 10px;
          color: #64748b;
          font-style: italic;
          text-align: center;
        }
        
        .preview-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 20px;
        }
        
        .cancel-button {
          background-color: #f1f5f9;
          color: #475569;
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .cancel-button:hover {
          background-color: #e2e8f0;
        }
        
        .confirm-button {
          background-color: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .confirm-button:hover:not(:disabled) {
          background-color: #059669;
        }
        
        .confirm-button:disabled {
          background-color: #94a3b8;
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        @media (max-width: 768px) {
          .preview-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          
          .preview-stats {
            flex-wrap: wrap;
            gap: 12px;
          }
          
          .preview-table th:nth-child(5),
          .preview-table td:nth-child(5),
          .preview-table th:nth-child(6),
          .preview-table td:nth-child(6),
          .preview-table th:nth-child(7),
          .preview-table td:nth-child(7) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ImportPreview;