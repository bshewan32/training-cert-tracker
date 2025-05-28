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
  documentPath: {
    type: String,
    default: 'pending' // temporary solution until file upload is implemented
  },
  status: {
    type: String,
    enum: ['Active', 'Expiring Soon', 'Expired'],
    default: 'Active'
  }
});

// Pre-save middleware to update status
CertificateSchema.pre('save', function(next) {
  const now = new Date();
  const expirationDate = this.expirationDate;
  const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

  if (expirationDate <= now) {
    this.status = 'Expired';
  } else if (expirationDate <= thirtyDaysFromNow) {
    this.status = 'Expiring Soon';
  } else {
    this.status = 'Active';
  }
  next();
});

module.exports = mongoose.model('Certificate', CertificateSchema);

// const mongoose = require('mongoose');

// const CertificateSchema = new mongoose.Schema({
//   staffMember: { 
//     type: String, 
//     required: true 
//   },
//   position: { 
//     type: String, 
//     required: true 
//   },
//   certificateType: { 
//     type: String, 
//     required: true 
//   },
//   issueDate: { 
//     type: Date, 
//     required: true,
//     set: v => new Date(v) // helps with date formatting
//   },
//   expirationDate: { 
//     type: Date, 
//     required: true,
//     set: v => new Date(v)
//   },
//   documentPath: {
//     type: String,
//     default: 'pending' // temporary solution until file upload is implemented
//   }
// });


// // Pre-save middleware to update status
// CertificateSchema.pre('save', function(next) {
//   const now = new Date();
//   const expirationDate = this.expirationDate;
//   const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

//   if (expirationDate <= now) {
//     this.status = 'Expired';
//   } else if (expirationDate <= thirtyDaysFromNow) {
//     this.status = 'Expiring Soon';
//   } else {
//     this.status = 'Active';
//   }
//   next();
// });

// module.exports = mongoose.model('Certificate', CertificateSchema);
