const { getDateRange } = require('./helpers');

describe('getDateRange', () => {
  test('returns provided start and end dates when valid', () => {
    const { startDate, endDate } = getDateRange('30d', '2025-01-01', '2025-01-31');
    expect(startDate).toBe('2025-01-01T00:00:00.000Z');
    expect(endDate).toBe('2025-01-31T00:00:00.000Z');
  });

  test('throws error when start is after end', () => {
    expect(() => getDateRange('30d', '2025-02-01', '2025-01-31')).toThrow('Start date must be before end date');
  });
});
