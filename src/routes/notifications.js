// routes/notifications.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendExpirationNotifications, findCertificatesExpiringSoon } = require('../services/emailService');

// Manual trigger - Admin can click button to send notifications
// POST /api/notifications/send
router.post('/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { daysThreshold = 60 } = req.body;
    
    console.log(`📧 Manual notification trigger by admin (threshold: ${daysThreshold} days)`);
    
    const stats = await sendExpirationNotifications(daysThreshold);
    
    res.json({
      success: true,
      message: 'Notifications sent successfully',
      stats
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notifications',
      error: error.message
    });
  }
});

// Get preview of certificates that would receive notifications
// GET /api/notifications/preview?days=60
router.get('/preview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const daysThreshold = parseInt(req.query.days) || 60;
    
    const certificates = await findCertificatesExpiringSoon(daysThreshold);
    
    // Format for preview
    const preview = certificates.map(cert => ({
      id: cert._id,
      staffMember: cert.staffMember,
      certType: cert.certType,
      expirationDate: cert.expirationDate,
      daysUntilExpiry: Math.ceil((new Date(cert.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
    }));
    
    res.json({
      success: true,
      count: preview.length,
      daysThreshold,
      certificates: preview
    });
  } catch (error) {
    console.error('Error getting preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get preview',
      error: error.message
    });
  }
});

// Cron job endpoint - Called by Render Cron Job
// GET /api/notifications/cron
// This endpoint doesn't require auth since it's called by Render's cron service
// But you should set a CRON_SECRET in your environment variables for security
router.get('/cron', async (req, res) => {
  try {
    // Optional: Add secret key verification for security
    const cronSecret = req.query.secret || req.headers['x-cron-secret'];
    
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️ Unauthorized cron attempt');
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    console.log(`⏰ Automated cron job triggered at ${new Date().toISOString()}`);
    
    const stats = await sendExpirationNotifications(60); // 60 days threshold
    
    res.json({
      success: true,
      message: 'Cron job completed successfully',
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    console.error('Cron job error:', error);
    res.status(500).json({
      success: false,
      message: 'Cron job failed',
      error: error.message
    });
  }
});

// Test endpoint - Send test email to verify configuration
// POST /api/notifications/test
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nodemailer = require('nodemailer');
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address required'
      });
    }
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
    
    await transporter.sendMail({
      from: {
        name: 'Certificate Tracker',
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER
      },
      to: email,
      subject: 'Test Email from Certificate Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✅ Email Configuration Test</h2>
          <p>If you're seeing this, your email configuration is working correctly!</p>
          <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `
    });
    
    res.json({
      success: true,
      message: `Test email sent to ${email}`
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

module.exports = router;