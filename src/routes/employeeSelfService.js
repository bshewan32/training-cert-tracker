const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const Certificate = require('../models/Certificate');
const User = require('../models/User');
const { authenticateToken } = require('../controllers/middleware/auth');
const mongoose = require('mongoose');

// Get current employee's information (linked by email)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get the logged-in user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find employee by matching email
    const employee = await Employee.findOne({ email: user.email })
      .populate('positions')
      .populate('primaryPosition');

    if (!employee) {
      return res.status(404).json({ 
        message: 'No employee record found. Please contact your administrator.',
        userEmail: user.email
      });
    }

    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee info:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get current employee's certificates
router.get('/my-certificates', authenticateToken, async (req, res) => {
  try {
    // Get the logged-in user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find employee by matching email
    const employee = await Employee.findOne({ email: user.email });

    if (!employee) {
      return res.status(404).json({ 
        message: 'No employee record found',
        certificates: []
      });
    }

    // Get all certificates for this employee with aggregation for certificate type details
    const certificates = await Certificate.aggregate([
      {
        $match: { staffMember: employee.name }
      },
      {
        $lookup: {
          from: "certificatetypes",
          localField: "certType",
          foreignField: "name",
          as: "certificateTypeDetails",
        },
      },
      {
        $unwind: {
          path: "$certificateTypeDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "positions",
          localField: "position",
          foreignField: "_id",
          as: "positionDetails",
        },
      },
      {
        $unwind: {
          path: "$positionDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          certificateName: {
            $ifNull: [
              "$certificateTypeDetails.name",
              { $ifNull: ["$certType", "$CertType"] },
            ],
          },
          validityPeriod: "$certificateTypeDetails.validityPeriod",
          positionTitle: "$positionDetails.title",
          positionDepartment: "$positionDetails.department",
          status: {
            $cond: {
              if: { $lt: ["$expirationDate", new Date()] },
              then: "EXPIRED",
              else: {
                $cond: {
                  if: { 
                    $lte: [
                      "$expirationDate", 
                      new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)
                    ] 
                  },
                  then: "EXPIRING SOON",
                  else: "ACTIVE"
                }
              }
            },
          },
          daysUntilExpiration: {
            $round: {
              $divide: [
                { $subtract: ["$expirationDate", new Date()] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
      },
      {
        $sort: { expirationDate: 1 } // Sort by expiration date (soonest first)
      }
    ]);

    res.json({
      employee: {
        name: employee.name,
        email: employee.email,
        positions: employee.positions
      },
      certificates: certificates
    });
  } catch (error) {
    console.error('Error fetching employee certificates:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get a specific certificate image for the logged-in employee
router.get('/my-certificates/:id/image', authenticateToken, async (req, res) => {
  try {
    // Get the logged-in user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find employee by matching email
    const employee = await Employee.findOne({ email: user.email });

    if (!employee) {
      return res.status(404).json({ message: 'No employee record found' });
    }

    // Get the certificate and verify it belongs to this employee
    const cert = await Certificate.findById(req.params.id);
    
    if (!cert) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    // Security check: ensure this certificate belongs to the logged-in employee
    if (cert.staffMember !== employee.name) {
      return res.status(403).json({ message: 'Unauthorized access to certificate' });
    }

    // Prefer Mongo GridFS
    if (cert.gridFsFileId) {
      const { GridFSBucket } = mongoose.mongo;
      const bucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'certfiles',
      });

      const { ObjectId } = mongoose.Types;
      const files = await bucket.find({ _id: new ObjectId(cert.gridFsFileId) }).toArray();

      if (!files.length) {
        return res.status(404).json({ message: 'File not found' });
      }

      const fileDoc = files[0];
      const mime = fileDoc.contentType || 
                   (fileDoc.metadata && fileDoc.metadata.mimeType) ||
                   'application/octet-stream';

      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      const stream = bucket.openDownloadStream(fileDoc._id);
      stream.on('error', () => res.status(404).json({ message: 'File not found' }));
      return stream.pipe(res);
    }

    // Legacy OneDrive fallback (if needed)
    if (cert.onedriveFileId) {
      // You'd need to implement OneDrive access here if still using it
      return res.status(501).json({ message: 'OneDrive access not implemented for employees' });
    }

    return res.status(404).json({ message: 'No stored image for this certificate' });
  } catch (error) {
    console.error('Error fetching certificate image:', error);
    res.status(500).json({ message: 'Failed to fetch image' });
  }
});

// Get employee's compliance summary
router.get('/my-compliance', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const employee = await Employee.findOne({ email: user.email })
      .populate('positions');

    if (!employee) {
      return res.status(404).json({ message: 'No employee record found' });
    }

    // Get all certificates for this employee
    const certificates = await Certificate.find({ staffMember: employee.name });

    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total: certificates.length,
      active: certificates.filter(c => new Date(c.expirationDate) > today).length,
      expiringSoon: certificates.filter(c => {
        const exp = new Date(c.expirationDate);
        return exp > today && exp <= thirtyDaysFromNow;
      }).length,
      expired: certificates.filter(c => new Date(c.expirationDate) <= today).length
    };

    res.json({
      employee: {
        name: employee.name,
        positions: employee.positions
      },
      stats: stats
    });
  } catch (error) {
    console.error('Error fetching compliance summary:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;