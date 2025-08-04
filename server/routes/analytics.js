const express = require('express');
const { Op } = require('sequelize');
const { Test, Client, Visitor, Conversion, UserClient } = require('../models');
const { authenticateToken } = require('./auth');
const { calculateSignificance, calculateConfidenceInterval } = require('../utils/statistics');
const router = express.Router();

// Get client dashboard stats
router.get('/stats/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;

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

    // Get date range (default last 30 days)
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const stats = await Promise.all([
      // Active tests count
      Test.count({
        where: { clientId, status: 'running' }
      }),

      // Total visitors
      Visitor.count({
        include: [{
          model: Test,
          where: { clientId },
          attributes: []
        }],
        where: {
          createdAt: { [Op.between]: [startDate, endDate] }
        }
      }),

      // Total conversions
      Conversion.count({
        include: [{
          model: Test,
          where: { clientId },
          attributes: []
        }],
        where: {
          createdAt: { [Op.between]: [startDate, endDate] }
        }
      }),

      // Revenue
      Conversion.sum('revenue', {
        include: [{
          model: Test,
          where: { clientId },
          attributes: []
        }],
        where: {
          createdAt: { [Op.between]: [startDate, endDate] }
        }
      })
    ]);

    const [activeTests, totalVisitors, totalConversions, totalRevenue] = stats;
    const conversionRate = totalVisitors > 0 ? ((totalConversions / totalVisitors) * 100).toFixed(2) : '0.00';

    res.json({
      activeTests,
      totalVisitors,
      totalConversions,
      totalRevenue: totalRevenue || 0,
      conversionRate: parseFloat(conversionRate),
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// Get detailed test report
router.get('/report/:testId', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findByPk(testId, {
      include: [{
        model: Client,
        attributes: ['id', 'name']
      }]
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

    // Get variation data
    const variations = await Promise.all(
      Object.keys(test.trafficSplit || {}).map(async (variationId) => {
        // Get visitor stats
        const visitors = await Visitor.findAll({
          where: { testId, variation: variationId },
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('COUNT', require('sequelize').distinct(require('sequelize').col('userId'))), 'unique'],
            'device', 'browser', 'country'
          ],
          group: ['device', 'browser', 'country']
        });

        const totalVisitors = await Visitor.count({
          where: { testId, variation: variationId }
        });

        const uniqueVisitors = await Visitor.count({
          where: { testId, variation: variationId },
          distinct: true,
          col: 'userId'
        });

        // Get conversion stats
        const conversions = await Conversion.findAll({
          where: { testId, variation: variationId },
          attributes: [
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'total'],
            [require('sequelize').fn('SUM', require('sequelize').col('revenue')), 'revenue'],
            [require('sequelize').fn('AVG', require('sequelize').col('revenue')), 'avgRevenue']
          ]
        });

        const totalConversions = await Conversion.count({
          where: { testId, variation: variationId }
        });

        const totalRevenue = await Conversion.sum('revenue', {
          where: { testId, variation: variationId }
        }) || 0;

        // Calculate metrics
        const conversionRate = totalVisitors > 0 ? (totalConversions / totalVisitors) : 0;
        const avgOrderValue = totalConversions > 0 ? (totalRevenue / totalConversions) : 0;
        const revenuePerVisitor = totalVisitors > 0 ? (totalRevenue / totalVisitors) : 0;

        // Get time series data (daily)
        const dailyStats = await Visitor.findAll({
          where: { testId, variation: variationId },
          attributes: [
            [require('sequelize').fn('DATE', require('sequelize').col('createdAt')), 'date'],
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'visitors']
          ],
          group: [require('sequelize').fn('DATE', require('sequelize').col('createdAt'))],
          order: [[require('sequelize').fn('DATE', require('sequelize').col('createdAt')), 'ASC']]
        });

        const dailyConversions = await Conversion.findAll({
          where: { testId, variation: variationId },
          attributes: [
            [require('sequelize').fn('DATE', require('sequelize').col('createdAt')), 'date'],
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'conversions'],
            [require('sequelize').fn('SUM', require('sequelize').col('revenue')), 'revenue']
          ],
          group: [require('sequelize').fn('DATE', require('sequelize').col('createdAt'))],
          order: [[require('sequelize').fn('DATE', require('sequelize').col('createdAt')), 'ASC']]
        });

        return {
          id: variationId,
          name: variationId === 'A' ? 'Original' : `Variation ${variationId}`,
          traffic: test.trafficSplit[variationId] || 0,
          metrics: {
            totalVisitors,
            uniqueVisitors,
            totalConversions,
            conversionRate,
            totalRevenue,
            avgOrderValue,
            revenuePerVisitor
          },
          demographics: {
            devices: visitors.filter(v => v.device).map(v => ({
              device: v.device,
              count: parseInt(v.getDataValue('total'))
            })),
            browsers: visitors.filter(v => v.browser).map(v => ({
              browser: v.browser,
              count: parseInt(v.getDataValue('total'))
            })),
            countries: visitors.filter(v => v.country).map(v => ({
              country: v.country,
              count: parseInt(v.getDataValue('total'))
            }))
          },
          timeSeries: {
            daily: dailyStats.map(d => ({
              date: d.getDataValue('date'),
              visitors: parseInt(d.getDataValue('visitors'))
            })),
            conversions: dailyConversions.map(d => ({
              date: d.getDataValue('date'),
              conversions: parseInt(d.getDataValue('conversions')),
              revenue: parseFloat(d.getDataValue('revenue')) || 0
            }))
          }
        };
      })
    );

    // Calculate statistical significance
    let significance = { pValue: 1, isSignificant: false, confidenceLevel: 0 };
    if (variations.length >= 2) {
      const controlVariation = variations[0];
      const testVariation = variations[1];
      
      if (controlVariation.metrics.totalVisitors > 0 && testVariation.metrics.totalVisitors > 0) {
        const pValue = calculateSignificance(
          controlVariation.metrics.totalConversions,
          controlVariation.metrics.totalVisitors,
          testVariation.metrics.totalConversions,
          testVariation.metrics.totalVisitors
        );

        significance = {
          pValue,
          isSignificant: pValue < 0.05,
          confidenceLevel: (1 - pValue) * 100,
          uplift: controlVariation.metrics.conversionRate > 0 
            ? ((testVariation.metrics.conversionRate - controlVariation.metrics.conversionRate) / controlVariation.metrics.conversionRate) * 100 
            : 0
        };
      }
    }

    res.json({
      test: {
        id: test.id,
        name: test.name,
        type: test.type,
        status: test.status,
        hypothesis: test.hypothesis,
        goal: test.goal,
        startedAt: test.startedAt,
        endedAt: test.endedAt,
        createdAt: test.createdAt
      },
      client: test.Client,
      variations,
      significance,
      summary: {
        totalVisitors: variations.reduce((sum, v) => sum + v.metrics.totalVisitors, 0),
        totalConversions: variations.reduce((sum, v) => sum + v.metrics.totalConversions, 0),
        totalRevenue: variations.reduce((sum, v) => sum + v.metrics.totalRevenue, 0),
        duration: test.startedAt ? Math.floor((new Date() - new Date(test.startedAt)) / (1000 * 60 * 60 * 24)) : 0
      }
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Get funnel analysis
router.get('/funnel/:testId', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Check access
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: test.clientId
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Access denied to this test' });
    }

    // Define funnel steps (can be customized per test)
    const funnelSteps = [
      { name: 'Visitors', event: 'visit' },
      { name: 'Goal Reached', event: 'conversion' },
    ];

    const funnelData = await Promise.all(
      Object.keys(test.trafficSplit || {}).map(async (variationId) => {
        const stepData = await Promise.all(
          funnelSteps.map(async (step, index) => {
            let count = 0;
            
            if (step.event === 'visit') {
              count = await Visitor.count({
                where: { testId, variation: variationId }
              });
            } else if (step.event === 'conversion') {
              count = await Conversion.count({
                where: { testId, variation: variationId }
              });
            }

            return {
              step: step.name,
              count,
              percentage: index === 0 ? 100 : 0 // Will calculate after getting visitor count
            };
          })
        );

        // Calculate percentages based on first step (visitors)
        const visitorCount = stepData[0].count;
        stepData.forEach((step, index) => {
          if (index > 0 && visitorCount > 0) {
            step.percentage = ((step.count / visitorCount) * 100).toFixed(2);
          }
        });

        return {
          variation: variationId,
          name: variationId === 'A' ? 'Original' : `Variation ${variationId}`,
          steps: stepData
        };
      })
    );

    res.json({
      testId,
      funnel: funnelData
    });
  } catch (error) {
    console.error('Get funnel error:', error);
    res.status(500).json({ error: 'Failed to retrieve funnel data' });
  }
});

// Export test data
router.get('/export/:testId', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const { format = 'json' } = req.query;

    const test = await Test.findByPk(testId);
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Check access
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId: test.clientId
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Access denied to this test' });
    }

    // Get all visitor and conversion data
    const [visitors, conversions] = await Promise.all([
      Visitor.findAll({
        where: { testId },
        attributes: [
          'userId', 'variation', 'userAgent', 'ipAddress', 
          'referrer', 'country', 'device', 'browser', 'firstVisit', 'createdAt'
        ],
        order: [['createdAt', 'ASC']]
      }),
      Conversion.findAll({
        where: { testId },
        attributes: [
          'userId', 'variation', 'goalType', 'goalValue', 
          'revenue', 'metadata', 'convertedAt'
        ],
        order: [['convertedAt', 'ASC']]
      })
    ]);

    const exportData = {
      test: {
        id: test.id,
        name: test.name,
        type: test.type,
        status: test.status,
        goal: test.goal,
        trafficSplit: test.trafficSplit,
        startedAt: test.startedAt,
        endedAt: test.endedAt,
        createdAt: test.createdAt
      },
      visitors: visitors.map(v => v.toJSON()),
      conversions: conversions.map(c => c.toJSON()),
      exportedAt: new Date().toISOString()
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'userId', 'variation', 'event', 'timestamp', 'device', 
        'browser', 'country', 'revenue', 'goalType'
      ];

      const csvRows = [];
      
      // Add visitor rows
      visitors.forEach(visitor => {
        csvRows.push([
          visitor.userId,
          visitor.variation,
          'visit',
          visitor.createdAt,
          visitor.device,
          visitor.browser,
          visitor.country,
          0,
          ''
        ]);
      });

      // Add conversion rows
      conversions.forEach(conversion => {
        csvRows.push([
          conversion.userId,
          conversion.variation,
          'conversion',
          conversion.convertedAt,
          '',
          '',
          '',
          conversion.revenue,
          conversion.goalType
        ]);
      });

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="test-${testId}-export.csv"`
      });
      
      return res.send(csvContent);
    }

    // Default JSON format
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="test-${testId}-export.json"`
    });
    
    res.json(exportData);
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Get client overview with all tests
router.get('/overview/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;

    // Check access
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.userId,
        clientId
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Get all tests with basic stats
    const tests = await Test.findAll({
      where: { clientId },
      attributes: [
        'id', 'name', 'type', 'status', 'trafficSplit', 'goal', 
        'startedAt', 'endedAt', 'createdAt'
      ],
      order: [['createdAt', 'DESC']]
    });

    // Get stats for each test
    const testsWithStats = await Promise.all(
      tests.map(async (test) => {
        const [totalVisitors, totalConversions, totalRevenue] = await Promise.all([
          Visitor.count({ where: { testId: test.id } }),
          Conversion.count({ where: { testId: test.id } }),
          Conversion.sum('revenue', { where: { testId: test.id } })
        ]);

        const conversionRate = totalVisitors > 0 ? ((totalConversions / totalVisitors) * 100).toFixed(2) : '0.00';

        return {
          ...test.toJSON(),
          stats: {
            totalVisitors,
            totalConversions,
            totalRevenue: totalRevenue || 0,
            conversionRate: parseFloat(conversionRate)
          }
        };
      })
    );

    // Calculate overall client stats
    const overallStats = testsWithStats.reduce((acc, test) => ({
      totalTests: acc.totalTests + 1,
      totalVisitors: acc.totalVisitors + test.stats.totalVisitors,
      totalConversions: acc.totalConversions + test.stats.totalConversions,
      totalRevenue: acc.totalRevenue + test.stats.totalRevenue,
      activeTests: acc.activeTests + (test.status === 'running' ? 1 : 0)
    }), {
      totalTests: 0,
      totalVisitors: 0,
      totalConversions: 0,
      totalRevenue: 0,
      activeTests: 0
    });

    overallStats.overallConversionRate = overallStats.totalVisitors > 0 
      ? ((overallStats.totalConversions / overallStats.totalVisitors) * 100).toFixed(2)
      : '0.00';

    res.json({
      clientId,
      overallStats,
      tests: testsWithStats
    });
  } catch (error) {
    console.error('Get overview error:', error);
    res.status(500).json({ error: 'Failed to retrieve overview' });
  }
});

module.exports = router;
