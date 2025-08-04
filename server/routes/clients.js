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

module.exports = router;
