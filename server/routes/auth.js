const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, Client, UserClient, Invitation } = require('../models');
const { generateApiKey, generateToken } = require('../utils/helpers');
const { sendEmail, sendInvitationEmail, sendWelcomeEmail } = require('../utils/email');
const router = express.Router();

// Default permissions for client roles
const rolePermissions = {
  admin: {
    canCreateTests: true,
    canEditTests: true,
    canDeleteTests: true,
    canViewAnalytics: true,
    canManageUsers: true
  },
  editor: {
    canCreateTests: true,
    canEditTests: true,
    canDeleteTests: false,
    canViewAnalytics: true,
    canManageUsers: false
  },
  viewer: {
    canCreateTests: false,
    canEditTests: false,
    canDeleteTests: false,
    canViewAnalytics: true,
    canManageUsers: false
  }
};

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

// Invite user to client
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

    // Check inviter has admin access to client
    const inviterAccess = await UserClient.findOne({
      where: { userId: req.user.userId, clientId, role: 'admin' }
    });

    if (!inviterAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const inviterUser = await User.findByPk(req.user.userId);

    // Create invitation token
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await Invitation.create({
      email,
      token,
      role,
      clientId,
      invitedBy: req.user.userId,
      expiresAt
    });

    // Send invitation email
    try {
      await sendInvitationEmail({
        to: email,
        inviterName: inviterUser?.name || 'Iemand',
        clientName: client.name,
        role,
        token
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
    }

    res.json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Accept invitation
router.post('/accept-invitation', [
  body('token').notEmpty(),
  body('name').optional().trim().isLength({ min: 2 }),
  body('password').optional().isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, name, password } = req.body;

    const invitation = await Invitation.findOne({ where: { token, status: 'pending' } });
    if (!invitation || invitation.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    // Find or create user
    let user = await User.findOne({ where: { email: invitation.email } });

    if (!user) {
      if (!name || !password) {
        return res.status(400).json({ error: 'Name and password required' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      user = await User.create({
        email: invitation.email,
        name,
        password: hashedPassword,
        role: 'user'
      });
    }

    // Associate user with client
    await UserClient.create({
      userId: user.id,
      clientId: invitation.clientId,
      role: invitation.role,
      permissions: rolePermissions[invitation.role]
    });

    await invitation.update({ status: 'accepted', acceptedAt: new Date() });

    const client = await Client.findByPk(invitation.clientId);

    try {
      await sendWelcomeEmail({ to: user.email, name: user.name, clientName: client.name });
    } catch (emailError) {
      console.error('Welcome email failed:', emailError);
    }

    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Invitation accepted',
      token: jwtToken,
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
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
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

// Logout (client-side should remove token)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Export both router and middleware
module.exports = router;
module.exports.authenticateToken = authenticateToken;
