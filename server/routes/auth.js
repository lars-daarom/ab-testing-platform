const express = require('express');
const { body, validationResult } = require('express-validator');
const { Client, UserClient, Invitation, Agency } = require('../models');
const { generateApiKey, generateToken } = require('../utils/helpers');
const { sendEmail, sendInvitationEmail, sendWelcomeEmail } = require('../utils/email');
const supabase = require('../services/supabaseService');
const authenticateToken = require('../middleware/auth');
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

    const client = await Client.create({
      name: `${name}'s Workspace`,
      domain: 'example.com',
      apiKey: generateApiKey(),
      agencyId: agency.id
    });

    await UserClient.create({
      userId: supabaseUser.id,
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
        id: supabaseUser.id,
        email: supabaseUser.email,
        name,
        role: 'admin'
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

    const userClients = await UserClient.findAll({
      where: { userId: supabaseUser.id },
      include: [{
        model: Client,
        attributes: ['id', 'name', 'domain'],
        include: [{ model: Agency, attributes: ['id', 'name', 'settings'] }]
      }]
    });

    const clients = userClients.map(uc => ({
      id: uc.Client.id,
      name: uc.Client.name,
      domain: uc.Client.domain
    }));
    const agency = userClients[0]?.Client?.Agency || null;

    res.json({
      message: 'Inloggen gelukt',
      token,
      user: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.name || supabaseUser.email
      },
      agency,
      clients
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Inloggen mislukt' });
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
      where: { userId: req.user.id, clientId, role: 'admin' }
    });

    if (!inviterAccess) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const client = await Client.findByPk(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const inviterName = req.user.user_metadata?.name || 'Iemand';
    const frontendUrl = process.env.FRONTEND_URL || req.get('origin') || 'http://localhost:3000';

    // Create invitation token
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await Invitation.create({
      email,
      token,
      role,
      clientId,
      invitedBy: req.user.id,
      expiresAt
    });

    // Send invitation email
    try {
      await sendInvitationEmail({
        to: email,
          inviterName,
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

    let accessToken;
    let supabaseUser;

    const signIn = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password: password || ''
    });

    if (signIn.error) {
      if (!name || !password) {
        return res.status(400).json({ error: 'Naam en wachtwoord vereist' });
      }
      const signUp = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: { data: { name } }
      });
      if (signUp.error) {
        return res.status(400).json({ error: 'Registratie mislukt' });
      }
      accessToken = signUp.data.session?.access_token || null;
      supabaseUser = signUp.data.user;
    } else {
      accessToken = signIn.data.session.access_token;
      supabaseUser = signIn.data.user;
    }

    await UserClient.create({
      userId: supabaseUser.id,
      clientId: invitation.clientId,
      role: invitation.role,
      permissions: rolePermissions[invitation.role]
    });

    await invitation.update({ status: 'accepted', acceptedAt: new Date() });

    try {
      await sendWelcomeEmail({
        to: invitation.email,
        name: supabaseUser.user_metadata?.name || invitation.email,
        clientName: client.name
      });
    } catch (emailError) {
      console.error('Welcome email failed:', emailError);
    }

    res.json({
      message: 'Uitnodiging geaccepteerd',
      token: accessToken,
      user: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.name || supabaseUser.email,
        role: 'user'
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
    const userClients = await UserClient.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Client,
        attributes: ['id', 'name', 'domain'],
        include: [{ model: Agency, attributes: ['id', 'name', 'settings'] }]
      }]
    });

    const clients = userClients.map(uc => ({
      id: uc.Client.id,
      name: uc.Client.name,
      domain: uc.Client.domain
    }));
    const agency = userClients[0]?.Client?.Agency || null;

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.user_metadata?.name || req.user.email
      },
      agency,
      clients
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

module.exports = router;
