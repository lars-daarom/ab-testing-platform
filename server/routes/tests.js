const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { Test, Client, UserClient, Visitor, Conversion } = require('../models');
const { authenticateToken } = require('./auth');
const { calculateSignificance } = require('../utils/statistics');
const router = express.Router();

// Get all tests for a client
router.get('/', authenticateToken, [
  query('clientId').isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('status').optional().isIn(['draft', 'running', 'paused', 'completed', 'archived'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { clientId, limit = 20, offset = 0, status } = req.query;

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

    const whereClause = { clientId };
    if (status) {
      whereClause.status = status;
    }

    const tests = await Test.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Visitor,
          attributes: [],
          required: false
        },
        {
          model: Conversion,
          attributes: [],
          required: false
        }
      ],
      attributes: [
        'id', 'name', 'type', 'status', 'hypothesis', 'trafficSplit', 
        'goal', 'targetUrl', 'startedAt', 'endedAt', 'createdAt', 'updatedAt',
        [
          require('sequelize').fn('COUNT', require('sequelize').col('Visitors.id')),
          'totalVisitors'
        ],
        [
          require('sequelize').fn('COUNT', require('sequelize').col('Conversions.id')),
          'totalConversions'
        ]
      ],
      group: ['Test.id'],
      subQuery: false
    });

    // Calculate significance for each test
    const testsWithStats = await Promise.all(
      tests.rows.map(async (test) => {
        const testData = test.toJSON();
        
        // Get detailed variation stats
        const variations = await Promise.all(
          Object.keys(test.trafficSplit || {}).map(async (variationId) => {
            const visitors = await Visitor.count({
              where: { testId: test.id, variation: variationId }
            });
            
            const conversions = await Conversion.count({
              where: { testId: test.id, variation: variationId }
            });

            return {
              id: variationId,
              name: variationId === 'A' ? 'Original' : `Variation ${variationId}`,
              visitors,
              conversions,
              conversionRate: visitors > 0 ? (conversions / visitors) * 100 : 0
            };
          })
        );

        // Calculate statistical significance
        let significance = 0;
        if (variations.length >= 2 && variations[0].visitors > 0 && variations[1].visitors > 0) {
          significance = calculateSignificance(
            variations[0].conversions, variations[0].visitors,
            variations[1].conversions, variations[1].visitors
          );
        }

        return {
          ...testData,
          variations,
          significance: significance || 0
        };
      })
    );

    res.json({
      tests: testsWithStats,
      pagination: {
        total: tests.count.length || tests.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < (tests.count.length || tests.count)
      }
    });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to retrieve tests' });
  }
});

// Get single test by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findByPk(id, {
      include: [
        {
          model: Client,
          attributes: ['id', 'name', 'domain']
        }
      ]
    });

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Check if user has access to this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: test.clientId
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Access denied to this test' });
    }

    // Get detailed variation stats
    const variations = await Promise.all(
      Object.keys(test.trafficSplit || {}).map(async (variationId) => {
        const visitors = await Visitor.count({
          where: { testId: test.id, variation: variationId }
        });
        
        const conversions = await Conversion.count({
          where: { testId: test.id, variation: variationId }
        });

        // Get recent visitor data for trends
        const recentVisitors = await Visitor.findAll({
          where: { testId: test.id, variation: variationId },
          attributes: ['createdAt'],
          order: [['createdAt', 'DESC']],
          limit: 100
        });

        return {
          id: variationId,
          name: variationId === 'A' ? 'Original' : `Variation ${variationId}`,
          visitors,
          conversions,
          conversionRate: visitors > 0 ? (conversions / visitors) * 100 : 0,
          recentActivity: recentVisitors.map(v => v.createdAt)
        };
      })
    );

    // Calculate statistical significance
    let significance = 0;
    if (variations.length >= 2 && variations[0].visitors > 0 && variations[1].visitors > 0) {
      significance = calculateSignificance(
        variations[0].conversions, variations[0].visitors,
        variations[1].conversions, variations[1].visitors
      );
    }

    res.json({
      test: {
        ...test.toJSON(),
        variations,
        significance
      }
    });
  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ error: 'Failed to retrieve test' });
  }
});

// Create new test
router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 2, max: 200 }),
  body('clientId').isUUID(),
  body('type').isIn(['ab', 'split_url', 'multivariate']),
  body('trafficSplit').isObject(),
  body('goal').isObject(),
  body('goal.type').isIn(['url', 'click', 'custom']),
  body('goal.value').isLength({ min: 1 }),
  body('hypothesis').optional().isLength({ max: 1000 }),
  body('targetUrl').optional().isURL()
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

    if (!userClient || !userClient.permissions.canCreateTests) {
      return res.status(403).json({ error: 'Permission denied to create tests for this client' });
    }

    // Validate traffic split adds up to 100
    const trafficTotal = Object.values(req.body.trafficSplit).reduce((sum, val) => sum + val, 0);
    if (Math.abs(trafficTotal - 100) > 0.01) {
      return res.status(400).json({ error: 'Traffic split must add up to 100%' });
    }

    // Create test
    const test = await Test.create({
      ...req.body,
      status: 'draft'
    });

    res.status(201).json({
      test: {
        id: test.id,
        name: test.name,
        type: test.type,
        status: test.status,
        trafficSplit: test.trafficSplit,
        goal: test.goal,
        createdAt: test.createdAt
      },
      message: 'Test created successfully'
    });
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ error: 'Failed to create test' });
  }
});

// Update test
router.patch('/:id', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2, max: 200 }),
  body('status').optional().isIn(['draft', 'running', 'paused', 'completed', 'archived']),
  body('trafficSplit').optional().isObject(),
  body('goal').optional().isObject(),
  body('hypothesis').optional().isLength({ max: 1000 }),
  body('targetUrl').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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

    if (!userClient || !userClient.permissions.canEditTests) {
      return res.status(403).json({ error: 'Permission denied to edit this test' });
    }

    // Handle status changes
    const updateData = { ...req.body };
    if (req.body.status && req.body.status !== test.status) {
      if (req.body.status === 'running' && test.status === 'draft') {
        updateData.startedAt = new Date();
      } else if (req.body.status === 'completed' && test.status === 'running') {
        updateData.endedAt = new Date();
      }
    }

    // Validate traffic split if provided
    if (req.body.trafficSplit) {
      const trafficTotal = Object.values(req.body.trafficSplit).reduce((sum, val) => sum + val, 0);
      if (Math.abs(trafficTotal - 100) > 0.01) {
        return res.status(400).json({ error: 'Traffic split must add up to 100%' });
      }
    }

    await test.update(updateData);

    res.json({
      test: {
        id: test.id,
        name: test.name,
        type: test.type,
        status: test.status,
        trafficSplit: test.trafficSplit,
        goal: test.goal,
        startedAt: test.startedAt,
        endedAt: test.endedAt,
        updatedAt: test.updatedAt
      },
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

// Delete test
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findByPk(id);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Check if user has permission to delete this test
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: test.clientId
      }
    });

    if (!userClient || !userClient.permissions.canDeleteTests) {
      return res.status(403).json({ error: 'Permission denied to delete this test' });
    }

    // Archive instead of delete to preserve data
    await test.update({ status: 'archived' });

    res.json({
      message: 'Test archived successfully'
    });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({ error: 'Failed to archive test' });
  }
});

// Duplicate test
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const originalTest = await Test.findByPk(id);
    if (!originalTest) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Check if user has permission to create tests for this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: originalTest.clientId
      }
    });

    if (!userClient || !userClient.permissions.canCreateTests) {
      return res.status(403).json({ error: 'Permission denied to duplicate this test' });
    }

    // Create duplicate test
    const duplicateTest = await Test.create({
      name: `${originalTest.name} (Copy)`,
      type: originalTest.type,
      hypothesis: originalTest.hypothesis,
      trafficSplit: originalTest.trafficSplit,
      goal: originalTest.goal,
      targetUrl: originalTest.targetUrl,
      variations: originalTest.variations,
      settings: originalTest.settings,
      clientId: originalTest.clientId,
      status: 'draft'
    });

    res.status(201).json({
      test: {
        id: duplicateTest.id,
        name: duplicateTest.name,
        type: duplicateTest.type,
        status: duplicateTest.status,
        createdAt: duplicateTest.createdAt
      },
      message: 'Test duplicated successfully'
    });
  } catch (error) {
    console.error('Duplicate test error:', error);
    res.status(500).json({ error: 'Failed to duplicate test' });
  }
});

module.exports = router;
