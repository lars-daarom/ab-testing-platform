const nodemailer = require('nodemailer');

// Email service configuration
const createTransporter = () => {
  // Use environment variables for email configuration
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Fallback to Gmail (less secure, for development only)
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });
  }

  // For development/testing - log emails to console
  if (process.env.NODE_ENV === 'development') {
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true
    });
  }

  // Production fallback - you should configure a real email service
  console.warn('⚠️  No email service configured. Emails will not be sent.');
  return null;
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @param {string} options.from - Sender email (optional)
 * @returns {Promise} Promise that resolves when email is sent
 */
const sendEmail = async (options) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('📧 Email would be sent:', options);
    return Promise.resolve({ messageId: 'dev-' + Date.now() });
  }

  const mailOptions = {
    from: options.from || process.env.FROM_EMAIL || 'A/B Testing Platform <noreply@abtesting.com>',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development' && result.message) {
      console.log('📧 Email sent (dev mode):', {
        to: options.to,
        subject: options.subject,
        content: result.message.toString()
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
};

/**
 * Send invitation email
 * @param {Object} options - Invitation options
 * @param {string} options.to - Recipient email
 * @param {string} options.inviterName - Name of person sending invitation
 * @param {string} options.clientName - Name of client/workspace
 * @param {string} options.role - User role
 * @param {string} options.token - Invitation token
 * @returns {Promise} Promise that resolves when email is sent
 */
const sendInvitationEmail = async (options) => {
  const { to, inviterName, clientName, role, token } = options;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const acceptUrl = `${frontendUrl}/accept-invitation?token=${token}`;

  const subject = `Uitnodiging voor ${clientName} - A/B Testing Platform`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Uitnodiging A/B Testing Platform</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .role-badge { background: #f3f4f6; color: #374151; padding: 4px 12px; border-radius: 16px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Je bent uitgenodigd!</h1>
        </div>
        <div class="content">
          <p>Hallo,</p>
          <p><strong>${inviterName}</strong> heeft je uitgenodigd om deel uit te maken van <strong>${clientName}</strong> op ons A/B Testing Platform.</p>
          
          <p>Je krijgt de rol van <span class="role-badge">${role}</span> toegewezen.</p>
          
          <div style="text-align: center;">
            <a href="${acceptUrl}" class="button">Uitnodiging Accepteren</a>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            Als de knop niet werkt, kopieer en plak deze link in je browser:<br>
            <a href="${acceptUrl}">${acceptUrl}</a>
          </p>
          
          <p style="font-size: 14px; color: #666;">
            Deze uitnodiging verloopt over 7 dagen.
          </p>
        </div>
        <div class="footer">
          <p>Met vriendelijke groet,<br>Het A/B Testing Platform Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hallo,

${inviterName} heeft je uitgenodigd om deel uit te maken van ${clientName} op ons A/B Testing Platform.

Je krijgt de rol van ${role} toegewezen.

Accepteer je uitnodiging via deze link:
${acceptUrl}

Deze uitnodiging verloopt over 7 dagen.

Met vriendelijke groet,
Het A/B Testing Platform Team
  `;

  return sendEmail({
    to,
    subject,
    html,
    text
  });
};

/**
 * Send welcome email to new users
 * @param {Object} options - Welcome email options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - User name
 * @param {string} options.clientName - Client name
 * @returns {Promise} Promise that resolves when email is sent
 */
const sendWelcomeEmail = async (options) => {
  const { to, name, clientName } = options;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const subject = `Welkom bij A/B Testing Platform - ${clientName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Welkom bij A/B Testing Platform</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welkom bij A/B Testing Platform!</h1>
        </div>
        <div class="content">
          <p>Hallo ${name},</p>
          <p>Welkom bij <strong>${clientName}</strong> op ons A/B Testing Platform!</p>
          
          <div style="text-align: center;">
            <a href="${frontendUrl}" class="button">Ga naar Dashboard</a>
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
          <p>Veel succes met je tests!<br>Het A/B Testing Platform Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    html
  });
};

module.exports = {
  sendEmail,
  sendInvitationEmail,
  sendWelcomeEmail
};
