// components/CompanyDocuments.jsx
import React, { useState, useEffect } from 'react';

const CompanyDocuments = ({ token }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [token]);

  const fetchDocuments = async () => {
    if (!token) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      setError('Failed to load documents');
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (docId, filename, fileType) => {
    try {
      const response = await fetch(`/api/documents/${docId}/view`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // For PDFs, open in new tab. For others, download
      if (fileType === 'pdf') {
        window.open(url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Clean up the URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      setError('Failed to open document');
      console.error('Error opening document:', err);
      setTimeout(() => setError(''), 3000);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFileIcon = (fileType) => {
    const icons = {
      'pdf': '📄',
      'doc': '📝',
      'docx': '📝',
      'xls': '📊',
      'xlsx': '📊',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️'
    };
    return icons[fileType] || '📎';
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📚 Company Documents</h2>
          <p style={styles.subtitle}>View and download shared company documents</p>
        </div>
      </div>

      {/* Search Bar */}
      {documents.length > 0 && (
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="🔍 Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={styles.errorBanner}>
          {error}
        </div>
      )}

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyIcon}>📁</p>
          <p style={styles.emptyText}>
            {searchTerm ? 'No documents match your search' : 'No documents available yet'}
          </p>
        </div>
      ) : (
        <div style={styles.documentGrid}>
          {filteredDocuments.map((doc) => (
            <div
              key={doc._id}
              style={styles.documentCard}
              onClick={() => handleViewDocument(doc._id, doc.filename, doc.fileType)}
            >
              <div style={styles.documentIcon}>
                {getFileIcon(doc.fileType)}
              </div>
              
              <div style={styles.documentInfo}>
                <h3 style={styles.documentName}>{doc.filename}</h3>
                
                {doc.description && (
                  <p style={styles.documentDescription}>{doc.description}</p>
                )}
                
                <div style={styles.documentMeta}>
                  <span style={styles.metaItem}>
                    {doc.fileType.toUpperCase()}
                  </span>
                  <span style={styles.metaDivider}>•</span>
                  <span style={styles.metaItem}>
                    {formatFileSize(doc.fileSize)}
                  </span>
                  <span style={styles.metaDivider}>•</span>
                  <span style={styles.metaItem}>
                    {formatDate(doc.uploadedAt)}
                  </span>
                </div>
              </div>

              <div style={styles.viewButton}>
                {doc.fileType === 'pdf' ? '👁️ View' : '⬇️ Download'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '20px',
    color: '#6b7280',
    fontSize: '1rem'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e5e7eb'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '2rem',
    color: '#111827',
    fontWeight: '700'
  },
  subtitle: {
    margin: 0,
    color: '#6b7280',
    fontSize: '1rem'
  },
  searchContainer: {
    marginBottom: '24px'
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '1rem',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  errorBanner: {
    padding: '12px 16px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #fecaca'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  emptyIcon: {
    fontSize: '4rem',
    margin: '0 0 16px 0'
  },
  emptyText: {
    fontSize: '1.1rem',
    color: '#6b7280',
    margin: 0
  },
  documentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  documentCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '2px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      borderColor: '#667eea'
    }
  },
  documentIcon: {
    fontSize: '2.5rem',
    flexShrink: 0
  },
  documentInfo: {
    flex: 1,
    minWidth: 0
  },
  documentName: {
    margin: '0 0 8px 0',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#111827',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  documentDescription: {
    margin: '0 0 8px 0',
    fontSize: '0.875rem',
    color: '#6b7280',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },
  documentMeta: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.75rem',
    color: '#9ca3af'
  },
  metaItem: {
    display: 'inline'
  },
  metaDivider: {
    margin: '0 8px'
  },
  viewButton: {
    padding: '8px 16px',
    backgroundColor: '#667eea',
    color: 'white',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '600',
    flexShrink: 0,
    whiteSpace: 'nowrap'
  }
};

// Add keyframes for spinner animation
const styleSheet = document.styleSheets[0];
const keyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
styleSheet.insertRule(keyframes, styleSheet.cssRules.length);

export default CompanyDocuments;