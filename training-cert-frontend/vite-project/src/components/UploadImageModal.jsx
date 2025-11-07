import { useState } from 'react';

const UploadImageModal = ({ certificate, token, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Check file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/certificates/${certificate._id}/upload-image`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Failed to upload image');
      }

      const result = await response.json();
      onSuccess(result.message || 'Image uploaded successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {certificate.gridFsFileId || certificate.onedriveFileId 
              ? 'Update Certificate Image' 
              : 'Add Certificate Image'}
          </h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="cert-info">
            <p><strong>Employee:</strong> {certificate.staffMember}</p>
            <p><strong>Certificate:</strong> {certificate.certType || certificate.certificateName}</p>
            <p><strong>Expires:</strong> {new Date(certificate.expirationDate).toLocaleDateString()}</p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="file-upload-section">
            <label htmlFor="imageFile" className="file-label">
              Select Image or PDF:
            </label>
            <input
              type="file"
              id="imageFile"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              disabled={uploading}
              className="file-input"
            />
            {file && (
              <div className="file-preview">
                📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            )}
          </div>

          <div className="button-group">
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="upload-btn"
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <button
              onClick={onClose}
              disabled={uploading}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .modal-content {
            background: white;
            border-radius: 12px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            max-height: 90vh;
            overflow-y: auto;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 2px solid #e5e7eb;
          }

          .modal-header h3 {
            margin: 0;
            color: #1a202c;
            font-size: 1.25rem;
            font-weight: 700;
          }

          .close-btn {
            background: #f3f4f6;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            font-size: 1.2rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: #e5e7eb;
          }

          .modal-body {
            padding: 20px;
          }

          .cert-info {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }

          .cert-info p {
            margin: 8px 0;
            color: #4a5568;
            font-size: 0.9rem;
          }

          .error-message {
            background: #fee2e2;
            color: #991b1b;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #dc2626;
          }

          .file-upload-section {
            margin-bottom: 20px;
          }

          .file-label {
            display: block;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 10px;
            font-size: 0.9rem;
          }

          .file-input {
            width: 100%;
            padding: 12px;
            border: 2px dashed #cbd5e0;
            border-radius: 8px;
            background: #f7fafc;
            cursor: pointer;
            transition: all 0.2s;
          }

          .file-input:hover:not(:disabled) {
            border-color: #667eea;
            background: #edf2f7;
          }

          .file-input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .file-preview {
            margin-top: 10px;
            padding: 10px;
            background: #d1fae5;
            color: #065f46;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 500;
          }

          .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
          }

          .upload-btn,
          .cancel-btn {
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 0.95rem;
          }

          .upload-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }

          .upload-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }

          .upload-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }

          .cancel-btn {
            background: #e5e7eb;
            color: #4a5568;
          }

          .cancel-btn:hover:not(:disabled) {
            background: #d1d5db;
          }

          .cancel-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          @media (max-width: 480px) {
            .modal-content {
              margin: 0;
              border-radius: 0;
              max-height: 100vh;
            }

            .button-group {
              flex-direction: column;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default UploadImageModal;