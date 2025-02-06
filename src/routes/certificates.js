const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const { authenticateToken } = require('../controllers/middleware/auth');
const upload = require('../controllers/middleware/upload');


router.post('/upload', authenticateToken, async (req, res) => {
  try {
    console.log('Received data:', req.body); // Debug log
    
    const certificate = new Certificate({
      staffMember: req.body.staffMember,
      position: req.body.position,
      certificateType: req.body.certificateType,
      issueDate: req.body.issueDate,
      expirationDate: req.body.expirationDate,
      documentPath: req.body.documentPath || 'pending'
    });
    
    const saved = await certificate.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error saving certificate:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get all certificates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const certificates = await Certificate.find();
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get certificates by status
router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    const certificates = await Certificate.find({ 
      status: req.params.status 
    });
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



module.exports = router;