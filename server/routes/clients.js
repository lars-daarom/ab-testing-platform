const express = require('express');
const { body, validationResult } = require('express-validator');
const { Client, User, UserClient, Test } = require('../models');
const { authenticateToken } = require('./auth');
const { generateApiKey } = require('../utils/helpers');
const router = express.Router();

// Get all clients for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      include: [{
        model: Client,
        through: UserClient,
        attributes: ['id', 'name', 'domain', 'createdAt']
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      clients: user.Clients || [],
      message: 'Clients retrieved successfully'
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to retrieve clients' });
  }
});

// Get single client by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access to this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: id
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    const client = await Client.findByPk(id, {
      include: [{
        model: User,
        through: UserClient,
        attributes: ['id', 'name', 'email'],
        include: [{
          model: UserClient,
          attributes: ['role', 'permissions']
        }]
      }]
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({
      client: {
        id: client.id,
        name: client.name,
        domain: client.domain,
        apiKey: client.apiKey,
        settings: client.settings,
        isActive: client.isActive,
        createdAt: client.createdAt,
        users: client.Users || []
      }
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to retrieve client' });
  }
});

// Create new client
router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('domain').isLength({ min: 3, max: 255 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, domain } = req.body;

    // Create client
    const client = await Client.create({
      name,
      domain,
      apiKey: generateApiKey()
    });

    // Associate user with client as admin
    await UserClient.create({
      userId: req.user.userId,
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

    res.status(201).json({
      client: {
        id: client.id,
        name: client.name,
        domain: client.domain,
        apiKey: client.apiKey,
        settings: client.settings,
        createdAt: client.createdAt
      },
      message: 'Client created successfully'
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.patch('/:id', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('domain').optional().isLength({ min: 3, max: 255 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    // Check if user has admin access to this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: id,
        role: 'admin'
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Update client
    await client.update(req.body);

    res.json({
      client: {
        id: client.id,
        name: client.name,
        domain: client.domain,
        settings: client.settings,
        updatedAt: client.updatedAt
      },
      message: 'Client updated successfully'
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Update client settings
router.patch('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has admin access to this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: id,
        role: 'admin'
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Merge settings
    const updatedSettings = {
      ...client.settings,
      ...req.body
    };

    await client.update({ settings: updatedSettings });

    res.json({
      settings: updatedSettings,
      message: 'Client settings updated successfully'
    });
  } catch (error) {
    console.error('Update client settings error:', error);
    res.status(500).json({ error: 'Failed to update client settings' });
  }
});

// Regenerate API key
router.post('/:id/regenerate-key', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has admin access to this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: id,
        role: 'admin'
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Generate new API key
    const newApiKey = generateApiKey();
    await client.update({ apiKey: newApiKey });

    res.json({
      apiKey: newApiKey,
      message: 'API key regenerated successfully'
    });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// Get client status (public endpoint for API access)
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const client = await Client.findOne({
      where: { id, apiKey },
      include: [{
        model: Test,
        where: { status: 'running' },
        required: false,
        attributes: ['id', 'name', 'type', 'status', 'trafficSplit', 'goal', 'createdAt']
      }]
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found or invalid API key' });
    }

    res.json({
      client: {
        id: client.id,
        name: client.name,
        domain: client.domain,
        isActive: client.isActive
      },
      activeTests: client.Tests || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get client status error:', error);
    res.status(500).json({ error: 'Failed to retrieve client status' });
  }
});

// Delete client (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has admin access to this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: id,
        role: 'admin'
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const client = await Client.findByPk(id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Soft delete by deactivating
    await client.update({ isActive: false });

    res.json({
      message: 'Client deactivated successfully'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
