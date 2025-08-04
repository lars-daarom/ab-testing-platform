/**
 * Statistical utility functions for A/B testing
 */

/**
 * Calculate Z-score for two proportions
 * @param {number} x1 - Successes in group 1
 * @param {number} n1 - Total in group 1
 * @param {number} x2 - Successes in group 2
 * @param {number} n2 - Total in group 2
 * @returns {number} Z-score
 */
const calculateZScore = (x1, n1, x2, n2) => {
  if (n1 === 0 || n2 === 0) return 0;
  
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const p = (x1 + x2) / (n1 + n2);
  
  const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
  
  if (se === 0) return 0;
  
  return (p1 - p2) / se;
};

/**
 * Calculate statistical significance (p-value) using Z-test
 * @param {number} conversions1 - Conversions for variation 1
 * @param {number} visitors1 - Visitors for variation 1
 * @param {number} conversions2 - Conversions for variation 2
 * @param {number} visitors2 - Visitors for variation 2
 * @returns {number} P-value (0-1, lower is more significant)
 */
const calculateSignificance = (conversions1, visitors1, conversions2, visitors2) => {
  if (visitors1 === 0 || visitors2 === 0) return 1;
  
  const zScore = Math.abs(calculateZScore(conversions1, visitors1, conversions2, visitors2));
  
  // Convert Z-score to p-value (two-tailed test)
  return 2 * (1 - normalCDF(zScore));
};

/**
 * Normal cumulative distribution function approximation
 * @param {number} x - Input value
 * @returns {number} CDF value
 */
const normalCDF = (x) => {
  // Abramowitz and Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1 + sign * y);
};

/**
 * Calculate confidence interval for conversion rate
 * @param {number} conversions - Number of conversions
 * @param {number} visitors - Number of visitors
 * @param {number} confidenceLevel - Confidence level (e.g., 0.95 for 95%)
 * @returns {Object} Confidence interval {lower, upper}
 */
const calculateConfidenceInterval = (conversions, visitors, confidenceLevel = 0.95) => {
  if (visitors === 0) return { lower: 0, upper: 0 };
  
  const p = conversions / visitors;
  const z = getZScore(confidenceLevel);
  const margin = z * Math.sqrt((p * (1 - p)) / visitors);
  
  return {
    lower: Math.max(0, p - margin),
    upper: Math.min(1, p + margin)
  };
};

/**
 * Get Z-score for confidence level
 * @param {number} confidenceLevel - Confidence level (0-1)
 * @returns {number} Z-score
 */
const getZScore = (confidenceLevel) => {
  const alpha = 1 - confidenceLevel;
  
  // Common Z-scores
  const zScores = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };
  
  return zScores[confidenceLevel] || 1.96;
};

/**
 * Calculate required sample size for A/B test
 * @param {number} baselineRate - Baseline conversion rate (0-1)
 * @param {number} minimumDetectableEffect - Minimum detectable effect (0-1)
 * @param {number} alpha - Type I error rate (default 0.05)
 * @param {number} beta - Type II error rate (default 0.20)
 * @returns {number} Required sample size per variation
 */
const calculateSampleSize = (baselineRate, minimumDetectableEffect, alpha = 0.05, beta = 0.20) => {
  const zAlpha = getZScore(1 - alpha/2);
  const zBeta = getZScore(1 - beta);
  
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + minimumDetectableEffect);
  const pBar = (p1 + p2) / 2;
  
  const numerator = Math.pow(zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2);
  const denominator = Math.pow(p2 - p1, 2);
  
  return Math.ceil(numerator / denominator);
};

/**
 * Calculate test duration in days
 * @param {number} sampleSize - Required sample size per variation
 * @param {number} dailyVisitors - Expected daily visitors
 * @param {number} trafficSplit - Traffic split for test variation (0-1)
 * @returns {number} Duration in days
 */
const calculateTestDuration = (sampleSize, dailyVisitors, trafficSplit = 0.5) => {
  const dailyVisitorsPerVariation = dailyVisitors * trafficSplit;
  return Math.ceil(sampleSize / dailyVisitorsPerVariation);
};

/**
 * Calculate uplift percentage
 * @param {number} baselineRate - Baseline conversion rate
 * @param {number} testRate - Test variation conversion rate
 * @returns {number} Uplift percentage
 */
const calculateUplift = (baselineRate, testRate) => {
  if (baselineRate === 0) return testRate > 0 ? Infinity : 0;
  return ((testRate - baselineRate) / baselineRate) * 100;
};

/**
 * Perform chi-square test
 * @param {number} conversions1 - Conversions for variation 1
 * @param {number} visitors1 - Visitors for variation 1
 * @param {number} conversions2 - Conversions for variation 2
 * @param {number} visitors2 - Visitors for variation 2
 * @returns {Object} Chi-square test results
 */
const chiSquareTest = (conversions1, visitors1, conversions2, visitors2) => {
  const nonConversions1 = visitors1 - conversions1;
  const nonConversions2 = visitors2 - conversions2;
  
  const total = visitors1 + visitors2;
  const totalConversions = conversions1 + conversions2;
  const totalNonConversions = nonConversions1 + nonConversions2;
  
  // Expected frequencies
  const e11 = (visitors1 * totalConversions) / total;
  const e12 = (visitors1 * totalNonConversions) / total;
  const e21 = (visitors2 * totalConversions) / total;
  const e22 = (visitors2 * totalNonConversions) / total;
  
  // Chi-square statistic
  const chiSquare = 
    Math.pow(conversions1 - e11, 2) / e11 +
    Math.pow(nonConversions1 - e12, 2) / e12 +
    Math.pow(conversions2 - e21, 2) / e21 +
    Math.pow(nonConversions2 - e22, 2) / e22;
  
  // Degrees of freedom = 1 for 2x2 table
  const pValue = 1 - chiSquareCDF(chiSquare, 1);
  
  return {
    chiSquare,
    pValue,
    isSignificant: pValue < 0.05
  };
};

/**
 * Chi-square cumulative distribution function approximation
 * @param {number} x - Chi-square value
 * @param {number} df - Degrees of freedom
 * @returns {number} CDF value
 */
const chiSquareCDF = (x, df) => {
  if (x <= 0) return 0;
  if (df === 1) {
    return 2 * normalCDF(Math.sqrt(x)) - 1;
  }
  
  // Simplified approximation for df = 1
  // For production use, consider using a proper gamma function implementation
  return Math.min(1, x / (x + df));
};

/**
 * Calculate Bayesian probability that B beats A
 * @param {number} conversionsA - Conversions for A
 * @param {number} visitorsA - Visitors for A
 * @param {number} conversionsB - Conversions for B
 * @param {number} visitorsB - Visitors for B
 * @param {number} priorAlpha - Prior alpha parameter (default 1)
 * @param {number} priorBeta - Prior beta parameter (default 1)
 * @returns {number} Probability that B > A
 */
const bayesianProbability = (conversionsA, visitorsA, conversionsB, visitorsB, priorAlpha = 1, priorBeta = 1) => {
  // Beta distribution parameters after observing data
  const alphaA = priorAlpha + conversionsA;
  const betaA = priorBeta + visitorsA - conversionsA;
  const alphaB = priorAlpha + conversionsB;
  const betaB = priorBeta + visitorsB - conversionsB;
  
  // Monte Carlo simulation to calculate P(B > A)
  const numSamples = 10000;
  let bWins = 0;
  
  for (let i = 0; i < numSamples; i++) {
    const sampleA = betaRandom(alphaA, betaA);
    const sampleB = betaRandom(alphaB, betaB);
    
    if (sampleB > sampleA) {
      bWins++;
    }
  }
  
  return bWins / numSamples;
};

/**
 * Generate random sample from Beta distribution
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @returns {number} Random sample
 */
const betaRandom = (alpha, beta) => {
  const x = gammaRandom(alpha, 1);
  const y = gammaRandom(beta, 1);
  return x / (x + y);
};

/**
 * Generate random sample from Gamma distribution (simplified)
 * @param {number} shape - Shape parameter
 * @param {number} scale - Scale parameter
 * @returns {number} Random sample
 */
const gammaRandom = (shape, scale) => {
  // Simplified gamma random generator
  // For production, use a proper gamma distribution implementation
  if (shape < 1) {
    return gammaRandom(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }
  
  const d = shape - 1/3;
  const c = 1 / Math.sqrt(9 * d);
  
  while (true) {
    let x = Math.random();
    let v = 1 + c * normalRandom();
    
    if (v <= 0) continue;
    
    v = v * v * v;
    x = Math.log(x);
    
    if (x < 0.5 * normalRandom() * normalRandom() + d - d * v + d * Math.log(v)) {
      return d * v * scale;
    }
  }
};

/**
 * Generate random sample from standard normal distribution
 * @returns {number} Random sample
 */
const normalRandom = () => {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

/**
 * Calculate statistical power
 * @param {number} sampleSize - Sample size per variation
 * @param {number} baselineRate - Baseline conversion rate
 * @param {number} testRate - Test variation conversion rate
 * @param {number} alpha - Significance level
 * @returns {number} Statistical power (0-1)
 */
const calculatePower = (sampleSize, baselineRate, testRate, alpha = 0.05) => {
  const zAlpha = getZScore(1 - alpha/2);
  const pooledRate = (baselineRate + testRate) / 2;
  const se = Math.sqrt(2 * pooledRate * (1 - pooledRate) / sampleSize);
  const effect = Math.abs(testRate - baselineRate);
  const zBeta = (effect / se) - zAlpha;
  
  return normalCDF(zBeta);
};

module.exports = {
  calculateZScore,
  calculateSignificance,
  calculateConfidenceInterval,
  calculateSampleSize,
  calculateTestDuration,
  calculateUplift,
  chiSquareTest,
  bayesianProbability,
  calculatePower,
  normalCDF,
  getZScore
};
