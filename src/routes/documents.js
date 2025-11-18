// routes/documents.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const jwt = require('jsonwebtoken');
const Document = require('../models/Document');
const User = require('../models/User');

// ===== INLINE AUTH MIDDLEWARE =====
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error verifying admin status' });
  }
};
// ===== END INLINE AUTH =====

// Configure multer for file uploads (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/jpg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, and images are allowed.'));
    }
  }
});

// Helper function to get file extension
const getFileExtension = (mimetype) => {
  const mimeMap = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png'
  };
  return mimeMap[mimetype] || 'unknown';
};

// GET /api/documents - List all documents (accessible to all logged-in users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const documents = await Document.find()
      .select('-gridFsId') // Don't send GridFS ID to frontend
      .sort({ uploadedAt: -1 });
    
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// GET /api/documents/:id/view - View/download a document (accessible to all logged-in users)
router.get('/:id/view', authenticateToken, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'documents'
    });

    // Set appropriate content type
    const contentTypeMap = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png'
    };

    res.set('Content-Type', contentTypeMap[document.fileType] || 'application/octet-stream');
    
    // For PDFs, open in browser. For others, force download
    if (document.fileType === 'pdf') {
      res.set('Content-Disposition', 'inline');
    } else {
      res.set('Content-Disposition', `attachment; filename="${document.originalName}"`);
    }

    const downloadStream = bucket.openDownloadStream(document.gridFsId);
    
    downloadStream.on('error', (error) => {
      console.error('Error streaming document:', error);
      res.status(500).json({ message: 'Error retrieving document' });
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('Error viewing document:', error);
    res.status(500).json({ message: 'Error viewing document' });
  }
});

// POST /api/documents/upload - Upload a new document (admin only)
router.post('/upload', authenticateToken, requireAdmin, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { description } = req.body;

    // Create GridFS bucket
    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'documents'
    });

    // Upload to GridFS
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype
    });

    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', async () => {
      try {
        // Create document record
        const document = new Document({
          filename: req.file.originalname,
          originalName: req.file.originalname,
          fileType: getFileExtension(req.file.mimetype),
          fileSize: req.file.size,
          gridFsId: uploadStream.id,
          description: description || '',
          uploadedBy: req.user.id
        });

        await document.save();

        res.json({
          message: 'Document uploaded successfully',
          document: {
            id: document._id,
            filename: document.filename,
            fileType: document.fileType,
            fileSize: document.fileSize,
            uploadedAt: document.uploadedAt
          }
        });
      } catch (error) {
        console.error('Error saving document record:', error);
        res.status(500).json({ message: 'Error saving document record' });
      }
    });

    uploadStream.on('error', (error) => {
      console.error('Error uploading to GridFS:', error);
      res.status(500).json({ message: 'Error uploading document' });
    });
  } catch (error) {
    console.error('Error in upload route:', error);
    res.status(500).json({ message: 'Error uploading document' });
  }
});

// DELETE /api/documents/:id - Delete a document (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete from GridFS
    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'documents'
    });

    await bucket.delete(document.gridFsId);

    // Delete document record
    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Error deleting document' });
  }
});

module.exports = router;