const request = require('supertest');
const express = require('express');

jest.mock('../models', () => ({
  Test: { count: jest.fn().mockResolvedValue(1) },
  Visitor: { count: jest.fn().mockResolvedValue(50) },
  Conversion: { count: jest.fn().mockResolvedValue(5) },
  UserClient: { findOne: jest.fn().mockResolvedValue({}) }
}));

jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'user1' };
  next();
});

const analyticsRoute = require('./analytics');
const app = express();
app.use('/analytics', analyticsRoute);

describe('GET /analytics/stats/:clientId', () => {
  test('returns stats for given date range', async () => {
    const res = await request(app).get('/analytics/stats/client1?start=2025-01-01&end=2025-01-31');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      activeTests: 1,
      totalVisitors: 50,
      totalConversions: 5,
      conversionRate: 10
    });
  });
});
