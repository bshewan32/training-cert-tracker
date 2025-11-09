const nodemailer = require('nodemailer');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Certificate = require('../models/Certificate');

// Create transporter using SendGrid
// No app passwords needed - just an API key!
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false, // use TLS
  auth: {
    user: 'apikey', // This is literally the string 'apikey'
    pass: process.env.SENDGRID_API_KEY // Your SendGrid API key
  }
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log('Email transporter error:', error);
  } else {
    console.log('✓ Email server is ready to send messages');
  }
});

// Calculate days until expiration
const getDaysUntilExpiry = (expirationDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expirationDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Get urgency level and color
const getUrgencyInfo = (daysLeft) => {
  if (daysLeft <= 0) return { level: 'EXPIRED', color: '#dc2626', bgcolor: '#fee2e2' };
  if (daysLeft <= 7) return { level: 'URGENT', color: '#dc2626', bgcolor: '#fee2e2' };
  if (daysLeft <= 14) return { level: 'HIGH', color: '#f59e0b', bgcolor: '#fef3c7' };
  if (daysLeft <= 30) return { level: 'MEDIUM', color: '#3b82f6', bgcolor: '#dbeafe' };
  return { level: 'LOW', color: '#10b981', bgcolor: '#d1fae5' };
};

// Send expiration reminder for a single certificate
const sendExpirationReminder = async (certificate) => {
  try {
    // Get employee email
    const employee = await Employee.findOne({ name: certificate.staffMember });
    const employeeEmail = employee?.email;

    // Get admin emails
    const admins = await User.find({ isAdmin: true });
    const adminEmails = admins.map(admin => admin.email).filter(Boolean);

    // If no recipients, log warning and skip
    if (!employeeEmail && adminEmails.length === 0) {
      console.warn(`No email recipients for certificate: ${certificate.staffMember} - ${certificate.certType}`);
      return false;
    }

    const daysLeft = getDaysUntilExpiry(certificate.expirationDate);
    const urgency = getUrgencyInfo(daysLeft);
    const expiryDate = new Date(certificate.expirationDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build recipient list for To/CC
    const mailOptions = {
      from: {
        name: 'Certificate Tracker',
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER
      },
      to: employeeEmail || adminEmails[0], // Primary recipient
      cc: employeeEmail ? adminEmails : adminEmails.slice(1), // CC admins if employee gets it
      subject: `${urgency.level} PRIORITY: Certificate Expiring in ${daysLeft} Days`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .urgency-badge { display: inline-block; padding: 8px 16px; margin: 15px 0; border-radius: 20px; font-weight: bold; background: ${urgency.bgcolor}; color: ${urgency.color}; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${urgency.color}; }
            .info-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; width: 150px; color: #6b7280; }
            .info-value { flex: 1; color: #111827; }
            .action-box { background: ${urgency.bgcolor}; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid ${urgency.color}; }
            .action-box h3 { margin-top: 0; color: ${urgency.color}; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Certificate Expiration Reminder</h1>
              <div class="urgency-badge">${urgency.level} PRIORITY</div>
            </div>

            <div class="content">
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Employee:</span>
                  <span class="info-value">${certificate.staffMember}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Certificate Type:</span>
                  <span class="info-value">${certificate.certType || certificate.certificateType || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Expiration Date:</span>
                  <span class="info-value">${expiryDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Days Remaining:</span>
                  <span class="info-value" style="color: ${urgency.color}; font-weight: bold; font-size: 18px;">${daysLeft} days</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Issue Date:</span>
                  <span class="info-value">${new Date(certificate.issueDate).toLocaleDateString()}</span>
                </div>
              </div>

              <div class="action-box">
                <h3>📋 Action Required</h3>
                <p style="margin: 0;">
                  ${daysLeft <= 7
                    ? '<strong>IMMEDIATE ACTION NEEDED:</strong> This certificate expires in less than a week. Please renew immediately to maintain compliance.'
                    : daysLeft <= 14
                    ? '<strong>URGENT:</strong> Please schedule renewal within the next week to avoid expiration.'
                    : 'Please plan to renew this certificate before the expiration date to maintain compliance.'}
                </p>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://training-cert-tracker.vercel.app'}" class="btn">
                  View in Dashboard
                </a>
              </div>
            </div>

            <div class="footer">
              <p>This is an automated reminder from Training Certificate Tracker</p>
              <p>Please do not reply to this email</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent for ${certificate.staffMember} - ${certificate.certType} (expires in ${daysLeft} days)`);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

// Send summary email to admins
const sendBatchSummary = async (stats) => {
  try {
    const admins = await User.find({ isAdmin: true });
    const adminEmails = admins.map(admin => admin.email).filter(Boolean);

    if (adminEmails.length === 0) {
      console.warn('No admin emails found for batch summary');
      return false;
    }

    const mailOptions = {
      from: {
        name: 'Certificate Tracker',
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER
      },
      to: adminEmails,
      subject: `Daily Certificate Expiration Report - ${new Date().toLocaleDateString()}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .stats { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .stat-box { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; display: flex; justify-content: space-between; align-items: center; }
            .stat-label { font-weight: bold; color: #6b7280; }
            .stat-value { font-size: 24px; font-weight: bold; color: #111827; }
            .success { border-left-color: #10b981; }
            .warning { border-left-color: #f59e0b; }
            .error { border-left-color: #dc2626; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Daily Certificate Report</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div class="stats">
              <div class="stat-box">
                <span class="stat-label">Certificates Checked</span>
                <span class="stat-value">${stats.totalCerts}</span>
              </div>
              <div class="stat-box success">
                <span class="stat-label">Emails Sent Successfully</span>
                <span class="stat-value" style="color: #10b981;">${stats.emailsSent}</span>
              </div>
              ${stats.emailsFailed > 0 ? `
              <div class="stat-box error">
                <span class="stat-label">Failed to Send</span>
                <span class="stat-value" style="color: #dc2626;">${stats.emailsFailed}</span>
              </div>
              ` : ''}
              <div class="stat-box warning">
                <span class="stat-label">No Email Address</span>
                <span class="stat-value" style="color: #f59e0b;">${stats.noEmailCount || 0}</span>
              </div>
            </div>

            <div class="footer">
              <p>Automated Daily Report from Training Certificate Tracker</p>
              <p><a href="${process.env.FRONTEND_URL || 'https://training-cert-tracker.vercel.app'}" style="color: #667eea;">View Dashboard</a></p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✓ Batch summary email sent to admins');
    return true;
  } catch (error) {
    console.error('Failed to send batch summary:', error);
    return false;
  }
};

// Find certificates expiring soon (NOT expired)
// This is what should be called for notifications
const findCertificatesExpiringSoon = async (daysThreshold = 60) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate the future date threshold
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
    
    // Find certificates that:
    // 1. Expire AFTER today (not expired yet)
    // 2. Expire BEFORE the threshold date (expiring soon)
    const certificates = await Certificate.find({
      expirationDate: {
        $gt: today, // Greater than today (not expired)
        $lte: thresholdDate // Less than or equal to threshold (expiring soon)
      }
    }).sort({ expirationDate: 1 }); // Sort by soonest first
    
    console.log(`Found ${certificates.length} certificates expiring within ${daysThreshold} days`);
    return certificates;
  } catch (error) {
    console.error('Error finding expiring certificates:', error);
    return [];
  }
};

// Send notifications for all expiring certificates
const sendExpirationNotifications = async (daysThreshold = 60) => {
  try {
    const certificates = await findCertificatesExpiringSoon(daysThreshold);
    
    const stats = {
      totalCerts: certificates.length,
      emailsSent: 0,
      emailsFailed: 0,
      noEmailCount: 0
    };
    
    console.log(`\n📧 Starting email notification process for ${certificates.length} certificates...`);
    
    for (const cert of certificates) {
      const daysLeft = getDaysUntilExpiry(cert.expirationDate);
      console.log(`Processing: ${cert.staffMember} - ${cert.certType} (${daysLeft} days left)`);
      
      const employee = await Employee.findOne({ name: cert.staffMember });
      
      if (!employee?.email) {
        console.warn(`  ⚠️ No email for ${cert.staffMember}`);
        stats.noEmailCount++;
        continue;
      }
      
      const success = await sendExpirationReminder(cert);
      
      if (success) {
        stats.emailsSent++;
      } else {
        stats.emailsFailed++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Email notification summary:');
    console.log(`   Total certificates: ${stats.totalCerts}`);
    console.log(`   ✓ Emails sent: ${stats.emailsSent}`);
    console.log(`   ✗ Failed: ${stats.emailsFailed}`);
    console.log(`   ⚠️ No email: ${stats.noEmailCount}\n`);
    
    // Send summary to admins
    await sendBatchSummary(stats);
    
    return stats;
  } catch (error) {
    console.error('Error in sendExpirationNotifications:', error);
    throw error;
  }
};

module.exports = {
  sendExpirationReminder,
  sendBatchSummary,
  findCertificatesExpiringSoon,
  sendExpirationNotifications
};