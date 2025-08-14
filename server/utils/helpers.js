const crypto = require('crypto');

/**
 * Generate a secure API key
 * @returns {string} API key
 */
const generateApiKey = () => {
  return 'ak_' + crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a secure token
 * @param {number} length - Token length
 * @returns {string} Token
 */
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash a string using SHA256
 * @param {string} str - String to hash
 * @returns {string} Hashed string
 */
const hashString = (str) => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

/**
 * Generate a user ID hash for consistent assignment
 * @param {string} userId - User ID
 * @param {string} testId - Test ID
 * @returns {number} Hash value
 */
const generateUserHash = (userId, testId) => {
  const hash = crypto.createHash('md5').update(userId + testId).digest('hex');
  return parseInt(hash.substring(0, 8), 16);
};

/**
 * Assign user to variation based on traffic split
 * @param {string} userId - User ID
 * @param {string} testId - Test ID
 * @param {Object} trafficSplit - Traffic split configuration
 * @returns {string} Assigned variation
 */
const assignVariation = (userId, testId, trafficSplit) => {
  const hash = generateUserHash(userId, testId);
  const percentage = hash % 100;
  
  let cumulative = 0;
  for (const [variation, traffic] of Object.entries(trafficSplit)) {
    cumulative += traffic;
    if (percentage < cumulative) {
      return variation;
    }
  }
  
  // Fallback to first variation
  return Object.keys(trafficSplit)[0] || 'A';
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitize string for safe output
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
};

/**
 * Format number with thousand separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
const formatNumber = (num) => {
  if (typeof num !== 'number') return '0';
  return num.toLocaleString();
};

/**
 * Calculate percentage with precision
 * @param {number} part - Part value
 * @param {number} total - Total value
 * @param {number} decimals - Decimal places
 * @returns {number} Percentage
 */
const calculatePercentage = (part, total, decimals = 2) => {
  if (total === 0) return 0;
  return parseFloat(((part / total) * 100).toFixed(decimals));
};

/**
 * Format date to ISO string without milliseconds
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  return new Date(date).toISOString().split('.')[0] + 'Z';
};

/**
 * Get date range for analytics
 * @param {string} period - Period ('24h', '7d', '30d', '90d')
 * @param {string} [start] - Optional start date (ISO or natural language)
 * @param {string} [end] - Optional end date (ISO or natural language)
 * @returns {Object} Start and end dates
 */
const { parseISO, parse, isValid, startOfMonth, endOfMonth, isAfter, isFuture } = require('date-fns');
const { nl } = require('date-fns/locale');

const getDateRange = (period = '30d', start, end) => {
  const now = new Date();
  let startDate;
  let endDate;

  if (start || end) {
    if (start) {
      startDate = parseISO(start);
      if (!isValid(startDate)) {
        const parsedStart = parse(start, 'LLLL yyyy', new Date(), { locale: nl });
        if (isValid(parsedStart)) startDate = startOfMonth(parsedStart);
      }
      if (!isValid(startDate)) throw new Error('Invalid start date');
    }

    if (end) {
      endDate = parseISO(end);
      if (!isValid(endDate)) {
        const parsedEnd = parse(end, 'LLLL yyyy', new Date(), { locale: nl });
        if (isValid(parsedEnd)) endDate = endOfMonth(parsedEnd);
      }
      if (!isValid(endDate)) throw new Error('Invalid end date');
    } else {
      endDate = now;
    }

    if (!startDate) {
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30);
    }

    if (isFuture(endDate)) endDate = now;
    if (isAfter(startDate, endDate)) throw new Error('Start date must be before end date');

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  endDate = now;
  startDate = new Date();

  switch (period) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
};

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} Is valid UUID
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Generate a slug from text
 * @param {string} text - Text to slugify
 * @returns {string} Slug
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Merge objects deeply
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
const deepMerge = (target, source) => {
  const output = Object.assign({}, target);
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
};

/**
 * Check if value is an object
 * @param {*} item - Item to check
 * @returns {boolean} Is object
 */
const isObject = (item) => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * Retry async function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} retries - Number of retries
 * @param {number} delay - Initial delay in ms
 * @returns {Promise} Promise that resolves when function succeeds
 */
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

/**
 * Parse user agent string
 * @param {string} userAgent - User agent string
 * @returns {Object} Parsed user agent info
 */
const parseUserAgent = (userAgent = '') => {
  const ua = userAgent.toLowerCase();
  
  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('chromium')) browser = 'Chromium';
  
  // Device detection
  let device = 'Desktop';
  if (ua.includes('mobile')) device = 'Mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) device = 'Tablet';
  
  // OS detection
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
  return { browser, device, os };
};

/**
 * Rate limit check
 * @param {Map} rateLimitMap - Rate limit storage
 * @param {string} key - Rate limit key
 * @param {number} limit - Request limit
 * @param {number} windowMs - Window size in milliseconds
 * @returns {boolean} Is within rate limit
 */
const checkRateLimit = (rateLimitMap, key, limit = 100, windowMs = 60000) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }
  
  const requests = rateLimitMap.get(key);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (validRequests.length >= limit) {
    return false;
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitMap.set(key, validRequests);
  
  return true;
};

module.exports = {
  generateApiKey,
  generateToken,
  hashString,
  generateUserHash,
  assignVariation,
  isValidEmail,
  sanitizeString,
  formatNumber,
  calculatePercentage,
  formatDate,
  getDateRange,
  isValidUUID,
  slugify,
  deepClone,
  deepMerge,
  isObject,
  retryWithBackoff,
  parseUserAgent,
  checkRateLimit
};
