const { sendEmail: sendGmailEmail } = require('../services/gmailService');

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
const sendEmail = async (userId, options) => {
  try {
    return await sendGmailEmail(userId, options);
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
 * @param {string} [options.frontendUrl] - Frontend base URL
 * @returns {Promise} Promise that resolves when email is sent
 */
const sendInvitationEmail = async (userId, options) => {
  const { to, inviterName, clientName, role, token, frontendUrl } = options;
  const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
  const acceptUrl = `${baseUrl}/accept-invitation?token=${token}`;

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

  return sendEmail(userId, {
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
const sendWelcomeEmail = async (userId, options) => {
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

  return sendEmail(userId, {
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
