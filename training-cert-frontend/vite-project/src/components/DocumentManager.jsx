// components/DocumentManager.jsx
import React, { useState, useEffect } from 'react';

const DocumentManager = ({ token }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [token]);

  const fetchDocuments = async () => {
    if (!token) return;
    
    setLoading(true);
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
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        setSelectedFile(null);
        return;
      }

      // Check file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png'
      ];

      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only PDF, Word, Excel, and images are allowed.');
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      formData.append('description', description);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      setSuccess(`${selectedFile.name} uploaded successfully!`);
      setSelectedFile(null);
      setDescription('');
      
      // Clear the file input
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.value = '';

      // Refresh the list
      fetchDocuments();
    } catch (err) {
      setError(err.message || 'Failed to upload document');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, filename) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setSuccess(`${filename} deleted successfully`);
      fetchDocuments();
    } catch (err) {
      setError('Failed to delete document');
      console.error('Delete error:', err);
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📚 Document Manager</h2>
          <p style={styles.subtitle}>Upload and manage shared company documents</p>
        </div>
      </div>

      {/* Upload Section */}
      <div style={styles.uploadSection}>
        <h3 style={styles.sectionTitle}>Upload New Document</h3>
        
        <div style={styles.uploadForm}>
          <div style={styles.fileInputContainer}>
            <input
              id="fileInput"
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              style={styles.fileInput}
            />
            <label htmlFor="fileInput" style={styles.fileLabel}>
              📎 Choose File
            </label>
            {selectedFile && (
              <span style={styles.fileName}>{selectedFile.name}</span>
            )}
          </div>

          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.descriptionInput}
          />

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              ...styles.uploadButton,
              opacity: (!selectedFile || uploading) ? 0.5 : 1,
              cursor: (!selectedFile || uploading) ? 'not-allowed' : 'pointer'
            }}
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload Document'}
          </button>
        </div>

        <div style={styles.uploadHints}>
          <p style={styles.hintText}>
            ✓ Accepted formats: PDF, Word, Excel, Images (JPG, PNG)
          </p>
          <p style={styles.hintText}>
            ✓ Maximum file size: 10MB
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={styles.errorBanner}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div style={styles.successBanner}>
          ✅ {success}
        </div>
      )}

      {/* Documents List */}
      <div style={styles.listSection}>
        <h3 style={styles.sectionTitle}>
          Uploaded Documents ({documents.length})
        </h3>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p>Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyIcon}>📁</p>
            <p style={styles.emptyText}>No documents uploaded yet</p>
          </div>
        ) : (
          <div style={styles.documentList}>
            {documents.map((doc) => (
              <div key={doc._id} style={styles.documentRow}>
                <div style={styles.documentIcon}>
                  {getFileIcon(doc.fileType)}
                </div>
                
                <div style={styles.documentDetails}>
                  <div style={styles.documentName}>{doc.filename}</div>
                  {doc.description && (
                    <div style={styles.documentDescription}>{doc.description}</div>
                  )}
                  <div style={styles.documentMeta}>
                    <span>{doc.fileType.toUpperCase()}</span>
                    <span style={styles.metaDivider}>•</span>
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span style={styles.metaDivider}>•</span>
                    <span>{formatDate(doc.uploadedAt)}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(doc._id, doc.filename)}
                  style={styles.deleteButton}
                >
                  🗑️ Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    backgroundColor: '#f9fafb',
    minHeight: '100vh'
  },
  header: {
    marginBottom: '32px',
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
  uploadSection: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: '1.25rem',
    color: '#374151',
    fontWeight: '600'
  },
  uploadForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '16px'
  },
  fileInputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  fileInput: {
    display: 'none'
  },
  fileLabel: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
    color: '#374151',
    transition: 'all 0.2s'
  },
  fileName: {
    color: '#6b7280',
    fontSize: '0.95rem',
    fontStyle: 'italic'
  },
  descriptionInput: {
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  uploadButton: {
    padding: '12px 24px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'all 0.2s',
    cursor: 'pointer'
  },
  uploadHints: {
    padding: '12px',
    backgroundColor: '#dbeafe',
    borderRadius: '8px',
    border: '1px solid #bfdbfe'
  },
  hintText: {
    margin: '4px 0',
    fontSize: '0.875rem',
    color: '#1e40af'
  },
  errorBanner: {
    padding: '12px 16px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #fecaca'
  },
  successBanner: {
    padding: '12px 16px',
    backgroundColor: '#d1fae5',
    color: '#065f46',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #a7f3d0'
  },
  listSection: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '12px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px'
  },
  emptyIcon: {
    fontSize: '3rem',
    margin: '0 0 12px 0'
  },
  emptyText: {
    fontSize: '1rem',
    color: '#6b7280',
    margin: 0
  },
  documentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  documentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    transition: 'all 0.2s'
  },
  documentIcon: {
    fontSize: '2rem',
    flexShrink: 0
  },
  documentDetails: {
    flex: 1,
    minWidth: 0
  },
  documentName: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  documentDescription: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginBottom: '4px'
  },
  documentMeta: {
    fontSize: '0.75rem',
    color: '#9ca3af'
  },
  metaDivider: {
    margin: '0 8px'
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0
  }
};

// Add keyframes animation
const styleSheet = document.styleSheets[0];
const keyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
if (styleSheet) {
  try {
    styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
  } catch (e) {
    // Ignore if already exists
  }
}

export default DocumentManager;