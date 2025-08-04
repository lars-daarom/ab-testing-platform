const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { Test, Client, UserClient } = require('../models');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Get all tests for a client
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.query;

    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    // Check if user has access to this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    const tests = await Test.findAll({
      where: { clientId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      tests,
      message: 'Tests retrieved successfully'
    });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to retrieve tests' });
  }
});

// Create new test
router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 2, max: 200 }),
  body('clientId').isUUID(),
  body('type').isIn(['ab', 'split_url', 'multivariate']),
  body('goal').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientId } = req.body;

    // Check if user has permission to create tests for this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Permission denied to create tests for this client' });
    }

    // Create test
    const test = await Test.create({
      ...req.body,
      status: 'draft'
    });

    res.status(201).json({
      test,
      message: 'Test created successfully'
    });
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

// Update test status
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findByPk(id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Check if user has permission to edit this test
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: test.clientId
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Permission denied to edit this test' });
    }

    await test.update(req.body);

    res.json({
      test,
      message: 'Test updated successfully'
    });
  } catch (error) {
    console.error('Update test error:', error);
    res.status(500).json({ error: 'Failed to update test' });
  }
});

// Get test configuration (for tracking script)
router.get('/:id/config', async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findOne({
      where: { id, status: 'running' },
      include: [{
        model: Client,
        attributes: ['domain', 'isActive']
      }]
    });

    if (!test || !test.Client.isActive) {
      return res.status(404).json({ error: 'Test not found or inactive' });
    }

    res.json({
      id: test.id,
      type: test.type,
      trafficSplit: test.trafficSplit,
      goal: test.goal,
      targetUrl: test.targetUrl,
      variations: test.variations || {}
    });
  } catch (error) {
    console.error('Get test config error:', error);
    res.status(500).json({ error: 'Failed to retrieve test configuration' });
  }
});

module.exports = router;
