const express = require('express');
const { body, validationResult } = require('express-validator');
const { Test, Client, Visitor, Conversion } = require('../models');
const router = express.Router();

// Track visitor
router.post('/visitor', [
  body('testId').isUUID(),
  body('userId').isLength({ min: 1, max: 100 }),
  body('variation').isLength({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { testId, userId, variation, userAgent } = req.body;

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
      return res.json({
        message: 'Visitor already tracked',
        visitor: {
          id: existingVisitor.id,
          variation: existingVisitor.variation,
          firstVisit: existingVisitor.firstVisit
        }
      });
    }

    // Create new visitor
    const visitor = await Visitor.create({
      testId,
      userId,
      variation,
      userAgent: userAgent || '',
      ipAddress: req.ip || '',
      device: 'Unknown',
      browser: 'Unknown',
      country: 'Unknown',
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
router.post('/conversion', [
  body('testId').isUUID(),
  body('userId').isLength({ min: 1, max: 100 }),
  body('variation').isLength({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { testId, userId, variation, revenue } = req.body;

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
      metadata: {},
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

// Health check for tracking
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'tracking'
  });
});

module.exports = router;
