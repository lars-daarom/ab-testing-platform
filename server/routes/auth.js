const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, Client, UserClient, Invitation } = require('../models');
const { generateApiKey } = require('../utils/helpers');
const { sendEmail } = require('../utils/email');
const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Register new user
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      role: 'admin' // First user is admin
    });

    // Create default client for new user
    const client = await Client.create({
      name: `${name}'s Workspace`,
      domain: 'example.com',
      apiKey: generateApiKey()
    });

    // Associate user with client
    await UserClient.create({
      userId: user.id,
      clientId: client.id,
      role: 'admin',
      permissions: {
        canCreateTests: true,
        canEditTests: true,
        canDeleteTests: true,
        canViewAnalytics: true,
        canManageUsers: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      client: {
        id: client.id,
        name: client.name,
        domain: client.domain
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ 
      where: { email },
      include: [{
        model: Client,
        through: UserClient,
        attributes: ['id', 'name', 'domain']
      }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      },
      clients: user.Clients || []
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'email', 'name', 'role', 'lastLogin'],
      include: [{
        model: Client,
        through: UserClient,
        attributes: ['id', 'name', 'domain']
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      },
      clients: user.Clients || []
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

// Send invitation
router.post('/invite', authenticateToken, [
  body('email').isEmail().normalizeEmail(),
  body('clientId').isUUID(),
  body('role').isIn(['admin', 'editor', 'viewer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, clientId, role } = req.body;

    // Check if user has permission to invite
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: clientId
      }
    });

    if (!userClient || userClient.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      // Check if already associated with client
      const existingAssociation = await UserClient.findOne({
        where: {
          userId: existingUser.id,
          clientId: clientId
        }
      });

      if (existingAssociation) {
        return res.status(400).json({ error: 'User already has access to this client' });
      }
    }

    // Generate invitation token
    const token = jwt.sign(
      { email, clientId, role, invitedBy: req.user.userId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Create invitation
    const invitation = await Invitation.create({
      email,
      token,
      role,
      clientId,
      invitedBy: req.user.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    // Get client info for email
    const client = await Client.findByPk(clientId);
    const inviter = await User.findByPk(req.user.userId);

    // Send invitation email
    try {
      await sendEmail({
        to: email,
        subject: `Uitnodiging voor ${client.name} - A/B Testing Platform`,
        html: `
          <h2>Je bent uitgenodigd!</h2>
          <p>Hallo,</p>
          <p>${inviter.name} heeft je uitgenodigd om deel uit te maken van <strong>${client.name}</strong> op ons A/B Testing Platform.</p>
          <p>Je rol wordt: <strong>${role}</strong></p>
          <p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}" 
               style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Uitnodiging Accepteren
            </a>
          </p>
          <p>Deze uitnodiging verloopt op ${invitation.expiresAt.toLocaleDateString('nl-NL')}.</p>
          <p>Met vriendelijke groet,<br>Het A/B Testing Platform Team</p>
        `
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Invitation error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Accept invitation
router.post('/accept-invitation', [
  body('token').exists(),
  body('password').optional().isLength({ min: 6 }),
  body('name').optional().trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password, name } = req.body;

    // Verify invitation token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired invitation token' });
    }

    // Find invitation
    const invitation = await Invitation.findOne({
      where: { token, status: 'pending' }
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invitation expired or not found' });
    }

    // Check if user exists
    let user = await User.findOne({ where: { email: decoded.email } });

    if (!user && (!password || !name)) {
      return res.status(400).json({ 
        error: 'Password and name required for new users',
        requiresRegistration: true
      });
    }

    // Create user if doesn't exist
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 12);
      user = await User.create({
        email: decoded.email,
        password: hashedPassword,
        name,
        role: 'user'
      });
    }

    // Create user-client association
    await UserClient.create({
      userId: user.id,
      clientId: decoded.clientId,
      role: decoded.role,
      permissions: {
        canCreateTests: decoded.role === 'admin' || decoded.role === 'editor',
        canEditTests: decoded.role === 'admin' || decoded.role === 'editor',
        canDeleteTests: decoded.role === 'admin',
        canViewAnalytics: true,
        canManageUsers: decoded.role === 'admin'
      }
    });

    // Update invitation status
    await invitation.update({
      status: 'accepted',
      acceptedAt: new Date()
    });

    // Generate JWT token
    const authToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Invitation accepted successfully',
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Generate new token
    const newToken = jwt.sign(
      { userId: req.user.userId, email: req.user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token: newToken,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Logout (client-side should remove token)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = { router, authenticateToken };
