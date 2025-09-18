// In your upload middleware file (controllers/middleware/upload.js)
const multer = require("multer");

// Change from diskStorage to memoryStorage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image files and PDFs are allowed!"), false);
    }
  },
});

module.exports = upload;
