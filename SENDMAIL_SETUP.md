# Email Notification Setup with Sendmail

This guide explains how to configure email notifications using sendmail on Render.

## Environment Variables Required

In your Render dashboard, configure these environment variables:

### Required Variables

1. **SYSTEM_SECRET**
   - A random secret string for authenticating admin endpoints
   - Generate one with: `openssl rand -base64 32`
   - Example: `xK9mP2vL8nQ5wR7tY3uI6oP1aS4dF7gH9jK2lM5nB8v`
   - This is what you enter in the prompt when sending notifications from the admin dashboard

2. **EMAIL_FROM** (Optional but recommended)
   - The email address to use as the sender
   - Example: `noreply@yourdomain.com`
   - If not set, defaults to `noreply@localhost`

3. **FRONTEND_URL**
   - Your Vercel frontend URL
   - Example: `https://training-cert-tracker.vercel.app`
   - Used in email links to the dashboard

## Sendmail Configuration on Render

Sendmail uses the local SMTP server on Render, so no API keys or passwords are needed.

**Note**: Emails sent from sendmail may be flagged as spam by some email providers since they come from Render's servers. To improve deliverability:

1. Add your domain to Render's custom domain settings
2. Configure SPF and DKIM records for your domain
3. Consider upgrading to a dedicated email service (SendGrid, Mailgun, etc.) for production use

## Testing Email Notifications

### From Admin Dashboard

1. Log in to your admin account
2. Navigate to the Notifications section
3. Click "Preview Recipients" to see who will receive emails
4. Click "Send Notifications"
5. When prompted, enter your SYSTEM_SECRET (the value you set in Render environment variables)

### Expected Behavior

- ✅ **Success**: You'll see a summary showing emails sent, failed, and employees with no email
- ❌ **403 Forbidden**: The SYSTEM_SECRET you entered doesn't match the one in Render - double-check the value
- ❌ **500 Error**: Check Render logs for email sending errors

## Setting Up Render Cron Job (Optional - for automated daily emails)

1. Go to your Render service dashboard
2. Click "Cron Jobs" → "New Cron Job"
3. Configure:
   - **Name**: Daily Certificate Reminders
   - **Command**: `curl -X POST -H "X-System-Secret: YOUR_SYSTEM_SECRET" https://your-backend.onrender.com/api/admin/send-expiration-reminders`
   - **Schedule**: `0 9 * * *` (9 AM daily)
   - Replace `YOUR_SYSTEM_SECRET` with your actual secret
   - Replace the URL with your Render backend URL

## Adding Employee Email Addresses

Employees must have email addresses in the database to receive notifications:

1. Go to the Employee Management section
2. Edit each employee
3. Add their email address
4. Save

## Troubleshooting

### 403 Forbidden Error
- The SYSTEM_SECRET doesn't match
- Check the value in Render environment variables
- Make sure you're copying the exact value (no extra spaces)

### Emails Not Sending
- Check Render logs for error messages
- Verify employees have email addresses in the database
- Test with a single notification first

### Emails Going to Spam
- This is common with sendmail
- Consider using a dedicated email service (SendGrid, Mailgun) for production
- Configure SPF/DKIM records if using a custom domain

## Upgrading to SendGrid (Recommended for Production)

For better email deliverability in production, consider switching to SendGrid:

1. Sign up for SendGrid (free tier: 100 emails/day)
2. Create an API key
3. Update environment variables:
   - `SENDGRID_API_KEY`: Your SendGrid API key
   - `EMAIL_FROM`: Your verified sender email
4. Update emailService.js to use SendGrid configuration

SendGrid configuration:
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});
```
