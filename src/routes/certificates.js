const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const { authenticateToken } = require('../controllers/middleware/auth');
const upload = require('../controllers/middleware/upload');

// POST new certificate
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    console.log('Received data:', req.body);

    const certificate = new Certificate({
      staffMember: req.body.staffMember,
      position: req.body.position,
      certType: req.body.certificateType,
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

// GET all certificates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const certificates = await Certificate.aggregate([
      {
        $lookup: {
          from: "certificatetypes",
          localField: "certType",
          foreignField: "name",
          as: "certificateTypeDetails"
        }
      },
      {
        $unwind: {
          path: "$certificateTypeDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
              $addFields: {
        certificateName: {
          $ifNull: [
            "$certificateTypeDetails.name",
            { $ifNull: ["$certType", "$CertType"] } // Support both old and new field names
          ]
        },
        validityPeriod: "$certificateTypeDetails.validityPeriod",
        status: {
          $cond: {
            if: { $lt: ["$expirationDate", new Date()] },
            then: "EXPIRED",
            else: "ACTIVE"
          }
        }
      }

      }
    ]);

    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET certificates by status
router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    const certificates = await Certificate.aggregate([
      {
        $lookup: {
          from: "certificatetypes",
          localField: "certType",
          foreignField: "name",
          as: "certificateTypeDetails"
        }
      },
      {
        $unwind: {
          path: "$certificateTypeDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          certificateName: {
            $ifNull: ["$certificateTypeDetails.name", "$certType"]
          },
          validityPeriod: "$certificateTypeDetails.validityPeriod",
          status: {
            $cond: {
              if: { $lt: ["$expirationDate", new Date()] },
              then: "EXPIRED",
              else: "ACTIVE"
            }
          }
        }
      },
      {
        $match: { status: req.params.status }
      }
    ]);
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ DELETE certificate by ID
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Certificate.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
