const { google } = require('googleapis');
const supabase = require('./supabaseService');

/**
 * Retrieve refresh token from Supabase auth metadata or gmail_tokens table
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function getRefreshToken(userId) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (!error && data?.user?.user_metadata?.gmail_refresh_token) {
      return data.user.user_metadata.gmail_refresh_token;
    }
  } catch (err) {
    console.error('Failed to fetch user metadata:', err);
  }

  const { data: tokenRow } = await supabase
    .from('gmail_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .single();

  return tokenRow?.refresh_token || null;
}

/**
 * Return an authorized Gmail client for the given user
 * @param {string} userId
 */
async function getAuthorizedGmailClient(userId) {
  const refreshToken = await getRefreshToken(userId);
  if (!refreshToken) {
    throw new Error('No Gmail refresh token found for user');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Send an email using Gmail API
 * @param {string} userId
 * @param {Object} mail
 */
async function sendEmail(userId, { to, subject, text, html }) {
  const gmail = await getAuthorizedGmailClient(userId);
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html || text || ''
  ];

  const message = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });
}

/**
 * Store refresh token in Supabase
 * @param {string} userId
 * @param {string} refreshToken
 */
async function storeRefreshToken(userId, refreshToken) {
  try {
    await supabase
      .from('gmail_tokens')
      .upsert({ user_id: userId, refresh_token: refreshToken }, { onConflict: 'user_id' });
  } catch (err) {
    console.error('Failed to store token in table:', err);
  }

  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    const metadata = data?.user?.user_metadata || {};
    metadata.gmail_refresh_token = refreshToken;
    await supabase.auth.admin.updateUserById(userId, { user_metadata: metadata });
  } catch (err) {
    console.error('Failed to update user metadata:', err);
  }
}

module.exports = {
  getAuthorizedGmailClient,
  sendEmail,
  storeRefreshToken
};
