const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const User = require('../models/User');
const { sendExpirationReminder } = require('../utils/emailService');

// Send reminder endpoint
router.post('/send-reminder/:certificateId', async (req, res) => {
  try {
    const certificate = await Certificate.findById(req.params.certificateId);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    const emailSent = await sendExpirationReminder(certificate);
    if (!emailSent) {
      throw new Error('Failed to send email');
    }

    res.json({ message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Reminder Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Your existing dashboard route
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const [totalCertificates, expiringSoon, expired, activeUsers] = await Promise.all([
      Certificate.countDocuments(),
      Certificate.countDocuments({
        expirationDate: { $gt: now, $lte: thirtyDaysFromNow }
      }),
      Certificate.countDocuments({
        expirationDate: { $lte: now }
      }),
      User.countDocuments({ active: true })
    ]);

    res.json({
      totalCertificates,
      expiringSoon,
      expired,
      activeUsers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

