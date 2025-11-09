const express = require('express');
const router = express.Router();
const Certificate = require('../models/Certificate');
const User = require('../models/User');
const { sendExpirationReminder, sendBatchSummary } = require('../utils/emailService');

// Send reminder for a single certificate (manual trigger)
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

// Batch send expiration reminders (for cron job)
router.post('/send-expiration-reminders', async (req, res) => {
  try {
    // Check for system secret (for cron job authentication)
    const systemSecret = req.headers['x-system-secret'];
    if (systemSecret !== process.env.SYSTEM_SECRET) {
      console.warn('Unauthorized batch reminder attempt');
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    console.log(`Starting batch email reminder job at ${now.toISOString()}`);

    // Find all certificates expiring in the next 30 days that are still active
    const expiringCerts = await Certificate.find({
      expirationDate: { $gt: now, $lte: thirtyDaysFromNow },
      status: { $in: ['Active', 'ACTIVE', 'Expiring Soon'] }
    }).populate('position');

    console.log(`Found ${expiringCerts.length} certificates expiring in the next 30 days`);

    let emailsSent = 0;
    let emailsFailed = 0;
    let noEmailCount = 0;

    // Send individual reminders
    for (const cert of expiringCerts) {
      const success = await sendExpirationReminder(cert);
      if (success === false) {
        emailsFailed++;
      } else if (success === true) {
        emailsSent++;
      } else {
        noEmailCount++; // No email address found
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const stats = {
      totalCerts: expiringCerts.length,
      emailsSent,
      emailsFailed,
      noEmailCount
    };

    // Send summary to admins
    await sendBatchSummary(stats);

    console.log(`Batch email job completed:`, stats);

    res.json({
      message: 'Batch reminder job completed',
      ...stats
    });
  } catch (error) {
    console.error('Batch reminder error:', error);
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

