const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Client, UserClient, Invitation, Agency } = require('../models');
const { generateApiKey, generateToken } = require('../utils/helpers');
const { sendEmail, sendInvitationEmail, sendWelcomeEmail } = require('../utils/email');
const supabase = require('../services/supabaseService');
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

// Middleware to verify auth token via Supabase
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Toegangstoken vereist' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    return res.status(403).json({ error: 'Ongeldig of verlopen token' });
  }

  req.user = { userId: data.user.id, email: data.user.email };
  next();
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

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Gebruiker bestaat al met dit e-mailadres' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) {
      return res.status(400).json({ error: 'Registratie mislukt' });
    }

    const supabaseUser = data.user;

    const agency = await Agency.create({
      name: `${name}'s Agency`
    });

    const user = await User.create({
      id: supabaseUser.id,
      email,
      password: 'supabase',
      name,
      role: 'admin',
      agencyId: agency.id
    });

    const client = await Client.create({
      name: `${name}'s Workspace`,
      domain: 'example.com',
      apiKey: generateApiKey(),
      agencyId: agency.id
    });

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

    const token = data.session?.access_token || null;

    res.status(201).json({
      message: 'Gebruiker succesvol aangemaakt',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      agency: {
        id: agency.id,
        name: agency.name,
        settings: agency.settings
      },
      client: {
        id: client.id,
        name: client.name,
        domain: client.domain
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registratie mislukt' });
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }

    const supabaseUser = data.user;
    const token = data.session.access_token;

    const user = await User.findByPk(supabaseUser.id, {
      include: [
        { model: Agency, attributes: ['id', 'name', 'settings'] },
        {
          model: Client,
          through: UserClient,
          attributes: ['id', 'name', 'domain']
        }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }

    await user.update({ lastLogin: new Date() });

    res.json({
      message: 'Inloggen gelukt',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      },
      agency: user.Agency,
      clients: user.Clients || []
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Inloggen mislukt' });
  }
});

// Google OAuth login
router.post('/login/google', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code is vereist' });
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return res.status(400).json({ error: 'Google login mislukt' });
    }

    const supabaseUser = data.user;
    const token = data.session.access_token;

    let user = await User.findByPk(supabaseUser.id, {
      include: [
        { model: Agency, attributes: ['id', 'name', 'settings'] },
        {
          model: Client,
          through: UserClient,
          attributes: ['id', 'name', 'domain']
        }
      ]
    });

    if (!user) {
      const name = supabaseUser.user_metadata?.name || supabaseUser.email;
      const agency = await Agency.create({ name: `${name}'s Agency` });
      user = await User.create({
        id: supabaseUser.id,
        email: supabaseUser.email,
        password: 'supabase',
        name,
        role: 'admin',
        agencyId: agency.id
      });

      const client = await Client.create({
        name: `${name}'s Workspace`,
        domain: 'example.com',
        apiKey: generateApiKey(),
        agencyId: agency.id
      });

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

      await user.update({ lastLogin: new Date() });

      return res.json({
        message: 'Inloggen gelukt',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastLogin: user.lastLogin
        },
        agency: {
          id: agency.id,
          name: agency.name,
          settings: agency.settings
        },
        clients: [client]
      });
    }

    await user.update({ lastLogin: new Date() });

    res.json({
      message: 'Inloggen gelukt',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin
      },
      agency: user.Agency,
      clients: user.Clients || []
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Google login mislukt' });
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
    const frontendUrl = process.env.FRONTEND_URL || req.get('origin') || 'http://localhost:3000';

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
        token,
        frontendUrl
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      return res.status(500).json({ error: 'Failed to send invitation email' });
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
      return res.status(400).json({ error: 'Ongeldige of verlopen uitnodiging' });
    }

    const client = await Client.findByPk(invitation.clientId);

    let user = await User.findOne({ where: { email: invitation.email } });
    let accessToken;

    if (!user) {
      if (!name || !password) {
        return res.status(400).json({ error: 'Naam en wachtwoord vereist' });
      }

      const { data, error } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: { data: { name } }
      });

      if (error) {
        return res.status(400).json({ error: 'Registratie mislukt' });
      }

      accessToken = data.session?.access_token || null;

      user = await User.create({
        id: data.user.id,
        email: invitation.email,
        password: 'supabase',
        name,
        role: 'user',
        agencyId: client.agencyId
      });
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password
      });

      if (error) {
        return res.status(401).json({ error: 'Ongeldige inloggegevens' });
      }
      accessToken = data.session.access_token;
    }

    await UserClient.create({
      userId: user.id,
      clientId: invitation.clientId,
      role: invitation.role,
      permissions: rolePermissions[invitation.role]
    });

    await invitation.update({ status: 'accepted', acceptedAt: new Date() });

    try {
      await sendWelcomeEmail({ to: user.email, name: user.name, clientName: client.name });
    } catch (emailError) {
      console.error('Welcome email failed:', emailError);
    }

    res.json({
      message: 'Uitnodiging geaccepteerd',
      token: accessToken,
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
    res.status(500).json({ error: 'Uitnodiging accepteren mislukt' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'email', 'name', 'role', 'lastLogin'],
      include: [
        { model: Agency, attributes: ['id', 'name', 'settings'] },
        {
          model: Client,
          through: UserClient,
          attributes: ['id', 'name', 'domain']
        }
      ]
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
      agency: user.Agency,
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
router.authenticateToken = authenticateToken;
module.exports = router;
