const express = require('express');
const { body, validationResult } = require('express-validator');
const { Test, Client, Visitor, Conversion } = require('../models');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const router = express.Router();

// Rate limiting for tracking endpoints
const rateLimiter = new RateLimiterMemory({
  points: 1000, // Number of requests
  duration: 60, // Per 60 seconds
});

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    const key = req.ip || 'anonymous';
    await rateLimiter.consume(key);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({ error: 'Too many requests' });
  }
};

// Helper function to parse user agent
const parseUserAgent = (userAgent) => {
  const ua = userAgent || '';
  
  // Simple browser detection
  let browser = 'Unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  // Simple device detection
  let device = 'Desktop';
  if (ua.includes('Mobile')) device = 'Mobile';
  else if (ua.includes('Tablet')) device = 'Tablet';
  
  return { browser, device };
};

// Helper function to get country from IP (simplified)
const getCountryFromIP = (ip) => {
  // In production, you would use a service like MaxMind GeoIP
  // For now, return a placeholder
  return 'Unknown';
};

// Track visitor
router.post('/visitor', rateLimitMiddleware, [
  body('testId').isUUID(),
  body('userId').isLength({ min: 1, max: 100 }),
  body('variation').isLength({ min: 1, max: 10 }),
  body('timestamp').optional().isISO8601(),
  body('userAgent').optional().isLength({ max: 500 }),
  body('referrer').optional().isURL({ require_protocol: false }),
  body('url').optional().isURL({ require_protocol: false })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { testId, userId, variation, userAgent, referrer, url } = req.body;

    // Verify test exists and is running
    const test = await Test.findOne({
      where: { id: testId, status: 'running' },
      include: [{
        model: Client,
        attributes: ['isActive']
      }]
    });

    if (!test || !test.Client.isActive) {
      return res.status(404).json({ error: 'Test not found or inactive' });
    }

    // Check if visitor already exists for this test
    const existingVisitor = await Visitor.findOne({
      where: { testId, userId }
    });

    if (existingVisitor) {
      // Update existing visitor with latest info
      await existingVisitor.update({
        userAgent: userAgent || existingVisitor.userAgent,
        referrer: referrer || existingVisitor.referrer
      });

      return res.json({
        message: 'Visitor updated',
        visitor: {
          id: existingVisitor.id,
          variation: existingVisitor.variation,
          firstVisit: existingVisitor.firstVisit
        }
      });
    }

    // Parse user agent and get location info
    const { browser, device } = parseUserAgent(userAgent);
    const country = getCountryFromIP(req.ip);

    // Create new visitor
    const visitor = await Visitor.create({
      testId,
      userId,
      variation,
      userAgent,
      ipAddress: req.ip,
      referrer,
      country,
      device,
      browser,
      firstVisit: new Date()
    });

    res.status(201).json({
      message: 'Visitor tracked successfully',
      visitor: {
        id: visitor.id,
        variation: visitor.variation,
        firstVisit: visitor.firstVisit
      }
    });
  } catch (error) {
    console.error('Track visitor error:', error);
    res.status(500).json({ error: 'Failed to track visitor' });
  }
});

// Track conversion
router.post('/conversion', rateLimitMiddleware, [
  body('testId').isUUID(),
  body('userId').isLength({ min: 1, max: 100 }),
  body('variation').isLength({ min: 1, max: 10 }),
  body('timestamp').optional().isISO8601(),
  body('revenue').optional().isNumeric(),
  body('metadata').optional().isObject(),
  body('url').optional().isURL({ require_protocol: false })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { testId, userId, variation, revenue, metadata, url } = req.body;

    // Verify test exists and is running
    const test = await Test.findOne({
      where: { id: testId, status: 'running' },
      include: [{
        model: Client,
        attributes: ['isActive']
      }]
    });

    if (!test || !test.Client.isActive) {
      return res.status(404).json({ error: 'Test not found or inactive' });
    }

    // Verify visitor exists for this test
    const visitor = await Visitor.findOne({
      where: { testId, userId }
    });

    if (!visitor) {
      return res.status(400).json({ error: 'Visitor not found. Track visitor first.' });
    }

    // Check if conversion already exists (prevent duplicates)
    const existingConversion = await Conversion.findOne({
      where: { testId, userId }
    });

    if (existingConversion) {
      return res.json({
        message: 'Conversion already tracked',
        conversion: {
          id: existingConversion.id,
          convertedAt: existingConversion.convertedAt
        }
      });
    }

    // Create conversion
    const conversion = await Conversion.create({
      testId,
      userId,
      variation,
      goalType: test.goal.type,
      goalValue: test.goal.value,
      revenue: revenue || 0,
      metadata: metadata || {},
      convertedAt: new Date()
    });

    res.status(201).json({
      message: 'Conversion tracked successfully',
      conversion: {
        id: conversion.id,
        variation: conversion.variation,
        convertedAt: conversion.convertedAt,
        revenue: conversion.revenue
      }
    });
  } catch (error) {
    console.error('Track conversion error:', error);
    res.status(500).json({ error: 'Failed to track conversion' });
  }
});

// Track custom event
router.post('/event', rateLimitMiddleware, [
  body('testId').isUUID(),
  body('userId').isLength({ min: 1, max: 100 }),
  body('eventName').isLength({ min: 1, max: 100 }),
  body('eventData').optional().isObject(),
  body('timestamp').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { testId, userId, eventName, eventData } = req.body;

    // Verify test exists and is running
    const test = await Test.findOne({
      where: { id: testId, status: 'running' },
      include: [{
        model: Client,
        attributes: ['isActive']
      }]
    });

    if (!test || !test.Client.isActive) {
      return res.status(404).json({ error: 'Test not found or inactive' });
    }

    // Verify visitor exists
    const visitor = await Visitor.findOne({
      where: { testId, userId }
    });

    if (!visitor) {
      return res.status(400).json({ error: 'Visitor not found. Track visitor first.' });
    }

    // Check if this is a goal conversion
    if (test.goal.type === 'custom' && test.goal.value === eventName) {
      // Track as conversion
      const existingConversion = await Conversion.findOne({
        where: { testId, userId }
      });

      if (!existingConversion) {
        await Conversion.create({
          testId,
          userId,
          variation: visitor.variation,
          goalType: 'custom',
          goalValue: eventName,
          revenue: eventData?.revenue || 0,
          metadata: eventData || {},
          convertedAt: new Date()
        });
      }
    }

    res.json({
      message: 'Event tracked successfully',
      eventName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Track event error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// Get test analytics
router.get('/analytics/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
      groupBy = 'day'
    } = req.query;

    // Verify test exists
    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Get visitor and conversion data grouped by variation
    const visitorStats = await Visitor.findAll({
      where: {
        testId,
        createdAt: {
          [require('sequelize').Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'variation',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('DATE', require('sequelize').col('createdAt')), 'date']
      ],
      group: ['variation', require('sequelize').fn('DATE', require('sequelize').col('createdAt'))],
      order: [['date', 'ASC']]
    });

    const conversionStats = await Conversion.findAll({
      where: {
        testId,
        createdAt: {
          [require('sequelize').Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'variation',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        [require('sequelize').fn('SUM', require('sequelize').col('revenue')), 'revenue'],
        [require('sequelize').fn('DATE', require('sequelize').col('createdAt')), 'date']
      ],
      group: ['variation', require('sequelize').fn('DATE', require('sequelize').col('createdAt'))],
      order: [['date', 'ASC']]
    });

    // Get device and browser breakdown
    const deviceStats = await Visitor.findAll({
      where: { testId },
      attributes: [
        'device',
        'variation',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['device', 'variation']
    });

    const browserStats = await Visitor.findAll({
      where: { testId },
      attributes: [
        'browser',
        'variation',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['browser', 'variation']
    });

    // Get country breakdown
    const countryStats = await Visitor.findAll({
      where: { testId },
      attributes: [
        'country',
        'variation',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
      ],
      group: ['country', 'variation'],
      limit: 10,
      order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']]
    });

    res.json({
      testId,
      period: { startDate, endDate },
      visitors: visitorStats,
      conversions: conversionStats,
      demographics: {
        devices: deviceStats,
        browsers: browserStats,
        countries: countryStats
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics' });
  }
});

// Get real-time test stats
router.get('/realtime/:testId', async (req, res) => {
  try {
    const { testId } = req.params;

    // Get stats from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const realtimeStats = await Promise.all([
      // Active visitors (last 5 minutes)
      Visitor.count({
        where: {
          testId,
          createdAt: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 5 * 60 * 1000)
          }
        }
      }),

      // Visitors by variation (last 24h)
      Visitor.findAll({
        where: {
          testId,
          createdAt: { [require('sequelize').Op.gte]: yesterday }
        },
        attributes: [
          'variation',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['variation']
      }),

      // Conversions by variation (last 24h)
      Conversion.findAll({
        where: {
          testId,
          createdAt: { [require('sequelize').Op.gte]: yesterday }
        },
        attributes: [
          'variation',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
          [require('sequelize').fn('SUM', require('sequelize').col('revenue')), 'revenue']
        ],
        group: ['variation']
      }),

      // Recent activity (last 100 events)
      Visitor.findAll({
        where: { testId },
        attributes: ['variation', 'createdAt', 'country', 'device'],
        order: [['createdAt', 'DESC']],
        limit: 100
      })
    ]);

    const [activeVisitors, visitorsByVariation, conversionsByVariation, recentActivity] = realtimeStats;

    res.json({
      testId,
      timestamp: new Date().toISOString(),
      activeVisitors,
      last24Hours: {
        visitors: visitorsByVariation,
        conversions: conversionsByVariation
      },
      recentActivity: recentActivity.map(activity => ({
        variation: activity.variation,
        timestamp: activity.createdAt,
        country: activity.country,
        device: activity.device
      }))
    });
  } catch (error) {
    console.error('Get realtime stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve realtime stats' });
  }
});

// Health check for tracking
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'tracking'
  });
});

module.exports = router;
