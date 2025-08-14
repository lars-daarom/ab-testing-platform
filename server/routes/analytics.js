const express = require('express');
const { Test, Client, Visitor, Conversion, UserClient } = require('../models');
const authenticateToken = require('../middleware/auth');
const { getDateRange } = require('../utils/helpers');
const { Op } = require('sequelize');
const router = express.Router();

// Get client dashboard stats
router.get('/stats/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { start, end } = req.query;

    let startDate, endDate;
    try {
      ({ startDate, endDate } = getDateRange('30d', start, end));
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Check if user has access to this client
    const userClient = await UserClient.findOne({
      where: {
        userId: req.user.id,
        clientId
      }
    });

    if (!userClient) {
      return res.status(403).json({ error: 'Access denied to this client' });
    }

    // Get basic stats
    const [activeTests, totalVisitors, totalConversions] = await Promise.all([
      Test.count({ where: { clientId, status: 'running', createdAt: { [Op.between]: [startDate, endDate] } } }),
      Visitor.count({
        where: { createdAt: { [Op.between]: [startDate, endDate] } },
        include: [{
          model: Test,
          where: { clientId },
          attributes: []
        }]
      }),
      Conversion.count({
        where: { createdAt: { [Op.between]: [startDate, endDate] } },
        include: [{
          model: Test,
          where: { clientId },
          attributes: []
        }]
      })
    ]);

    const conversionRate = totalVisitors > 0 ? 
      parseFloat(((totalConversions / totalVisitors) * 100).toFixed(2)) : 0;

    res.json({
      activeTests,
      totalVisitors,
      totalConversions,
      conversionRate
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

module.exports = router;
