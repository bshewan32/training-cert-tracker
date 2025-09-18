const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  staffMember: { 
    type: String, 
    required: true 
  },
  // Changed to reference an actual position ID
  position: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Position',
    required: true 
  },
  certType: { 
    type: String, 
    required: true 
  },
  issueDate: { 
    type: Date, 
    required: true,
    set: v => new Date(v) // helps with date formatting
  },
  expirationDate: { 
    type: Date, 
    required: true,
    set: v => new Date(v)
  },
  // Keep existing documentPath for backward compatibility
  documentPath: {
    type: String,
    default: 'pending' // temporary solution until file upload is implemented
  },
  // NEW: OneDrive integration fields
  onedriveFileId: {
    type: String,
    default: null,
    index: true, // Index for faster lookups when fetching images
    sparse: true // Only index documents that have this field
  },
  onedriveFilePath: {
    type: String,
    default: null,
    trim: true // Remove any whitespace
  },
  // Optional: Store original filename for display purposes
  originalFileName: {
    type: String,
    default: null,
    trim: true
  },
  // Optional: Store file metadata
  fileMetadata: {
    size: { type: Number, default: null }, // File size in bytes
    mimeType: { type: String, default: null }, // e.g., 'image/jpeg', 'application/pdf'
    uploadedAt: { type: Date, default: null } // When the file was uploaded
  },
  status: {
    type: String,
    enum: ['Active', 'Expiring Soon', 'Expired'],
    default: 'Active'
  },
  // Add timestamps for better tracking
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update status and timestamps
CertificateSchema.pre('save', function(next) {
  const now = new Date();
  
  // Update the updatedAt timestamp
  this.updatedAt = now;
  
  // Calculate status based on expiration date
  const expirationDate = this.expirationDate;
  const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

  if (expirationDate <= now) {
    this.status = 'Expired';
  } else if (expirationDate <= thirtyDaysFromNow) {
    this.status = 'Expiring Soon';
  } else {
    this.status = 'Active';
  }
  
  // Set file upload timestamp if OneDrive file is being added for the first time
  if (this.onedriveFileId && !this.fileMetadata.uploadedAt) {
    this.fileMetadata.uploadedAt = now;
  }
  
  next();
});

// Virtual property to check if certificate has an image
CertificateSchema.virtual('hasImage').get(function() {
  return !!(this.onedriveFileId || (this.documentPath && this.documentPath !== 'pending'));
});

// Instance method to get the display filename
CertificateSchema.methods.getDisplayFileName = function() {
  if (this.originalFileName) {
    return this.originalFileName;
  }
  if (this.onedriveFilePath) {
    return this.onedriveFilePath.split('/').pop(); // Get filename from path
  }
  return 'Certificate Document';
};

// Instance method to check if file is in OneDrive
CertificateSchema.methods.isStoredInOneDrive = function() {
  return !!(this.onedriveFileId);
};

// Static method to find certificates with images
CertificateSchema.statics.findWithImages = function() {
  return this.find({
    $or: [
      { onedriveFileId: { $exists: true, $ne: null } },
      { documentPath: { $exists: true, $ne: 'pending', $ne: null } }
    ]
  });
};

// Static method to find certificates without images
CertificateSchema.statics.findWithoutImages = function() {
  return this.find({
    $and: [
      { $or: [{ onedriveFileId: { $exists: false } }, { onedriveFileId: null }] },
      { $or: [{ documentPath: { $exists: false } }, { documentPath: 'pending' }, { documentPath: null }] }
    ]
  });
};

// Index for better query performance
CertificateSchema.index({ staffMember: 1, certType: 1 });
CertificateSchema.index({ expirationDate: 1 });
CertificateSchema.index({ status: 1 });
CertificateSchema.index({ createdAt: -1 });

// Ensure virtual fields are serialized
CertificateSchema.set('toJSON', { virtuals: true });
CertificateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Certificate', CertificateSchema);