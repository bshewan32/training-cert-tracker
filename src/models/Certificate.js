// models/Certificate.js
const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema({
  staffMember: {
    type: String,
    required: true,
  },
  // Reference to a Position document
  position: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Position",
    required: true,
  },
  certType: {
    type: String,
    required: true,
  },
  issueDate: {
    type: Date,
    required: true,
    set: (v) => new Date(v),
  },
  expirationDate: {
    type: Date,
    required: true,
    set: (v) => new Date(v),
  },

  // Backward-compatibility (legacy file path on disk, if any)
  documentPath: {
    type: String,
    default: "pending",
  },

  // ---- OneDrive (legacy/optional) ----
  onedriveFileId: {
    type: String,
    default: null,
    index: true,
    sparse: true,
  },
  onedriveFilePath: {
    type: String,
    default: null,
    trim: true,
  },

  // ---- GridFS (preferred) ----
  gridFsFileId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true,
    sparse: true,
  },
  gridFsFilename: {
    type: String,
    default: null,
    trim: true,
  },

  // Display/original filename (works for either storage)
  originalFileName: {
    type: String,
    default: null,
    trim: true,
  },

  // Optional file metadata
  fileMetadata: {
    size: { type: Number, default: null },       // bytes
    mimeType: { type: String, default: null },   // e.g. image/jpeg, application/pdf
    uploadedAt: { type: Date, default: null },   // first time we stored a file
  },

  status: {
    type: String,
    enum: ["Active", "Expiring Soon", "Expired"],
    default: "Active",
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },

  // ---- Revision / renewal history ----
  revisions: [
    {
      issueDate: { type: Date, required: true },
      expirationDate: { type: Date, required: true },
      archivedAt: { type: Date, default: Date.now },

      // Preserve whichever storage the previous version used
      onedriveFileId: { type: String, default: null },
      onedriveFilePath: { type: String, default: null },
      gridFsFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
      gridFsFilename: { type: String, default: null },

      originalFileName: { type: String, default: null },
      status: { type: String, enum: ["Active", "Expiring Soon", "Expired"] },
      notes: { type: String, default: "" },
    },
  ],
});

// ---------------- Pre-save: status + timestamps + first-upload marker -------------
CertificateSchema.pre("save", function (next) {
  const now = new Date();
  this.updatedAt = now;

  // Calculate status
  const expiry = this.expirationDate;
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (expiry <= now) this.status = "Expired";
  else if (expiry <= in30) this.status = "Expiring Soon";
  else this.status = "Active";

  // Mark uploadedAt on first attach (GridFS or OneDrive)
  const hasAnyFile =
    !!this.gridFsFileId ||
    !!this.onedriveFileId ||
    (this.documentPath && this.documentPath !== "pending");

  if (hasAnyFile && (!this.fileMetadata || !this.fileMetadata.uploadedAt)) {
    this.fileMetadata = this.fileMetadata || {};
    this.fileMetadata.uploadedAt = now;
  }

  next();
});

// ---------------- Virtuals ----------------
CertificateSchema.virtual("hasImage").get(function () {
  return !!(
    this.gridFsFileId ||
    this.onedriveFileId ||
    (this.documentPath && this.documentPath !== "pending")
  );
});

// Prefer a friendly name: originalFileName → GridFS → OneDrive → fallback
CertificateSchema.methods.getDisplayFileName = function () {
  if (this.originalFileName) return this.originalFileName;
  if (this.gridFsFilename) return this.gridFsFilename;
  if (this.onedriveFilePath) return this.onedriveFilePath.split("/").pop();
  return "Certificate Document";
};

CertificateSchema.methods.isStoredInGridFS = function () {
  return !!this.gridFsFileId;
};

CertificateSchema.methods.isStoredInOneDrive = function () {
  return !!this.onedriveFileId;
};

// ---------------- Statics (include GridFS) ----------------
CertificateSchema.statics.findWithImages = function () {
  return this.find({
    $or: [
      { gridFsFileId: { $exists: true, $ne: null } },
      { onedriveFileId: { $exists: true, $ne: null } },
      { documentPath: { $exists: true, $ne: "pending", $ne: null } },
    ],
  });
};

CertificateSchema.statics.findWithoutImages = function () {
  return this.find({
    $and: [
      {
        $and: [
          { $or: [{ gridFsFileId: { $exists: false } }, { gridFsFileId: null }] },
          { $or: [{ onedriveFileId: { $exists: false } }, { onedriveFileId: null }] },
        ],
      },
      {
        $or: [
          { documentPath: { $exists: false } },
          { documentPath: "pending" },
          { documentPath: null },
        ],
      },
    ],
  });
};

// ---------------- Indexes ----------------
CertificateSchema.index({ staffMember: 1, certType: 1 });
CertificateSchema.index({ expirationDate: 1 });
CertificateSchema.index({ status: 1 });
CertificateSchema.index({ createdAt: -1 });
CertificateSchema.index({ gridFsFileId: 1 }, { sparse: true });
CertificateSchema.index({ onedriveFileId: 1 }, { sparse: true });

// Serialize virtuals
CertificateSchema.set("toJSON", { virtuals: true });
CertificateSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Certificate", CertificateSchema);
