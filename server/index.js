const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./models');
const { router: authRoutes } = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const testRoutes = require('./routes/tests');
const trackingRoutes = require('./routes/tracking');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:3000',
  credentials: true
}));

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/track', trackingRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve tracking script
app.get('/track.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
  
  const trackingScript = `
(function() {
  'use strict';
  
  var ABTesting = {
    apiEndpoint: '${process.env.NODE_ENV === 'production' ? process.env.API_URL : 'http://localhost:5000'}/api',
    
    init: function(config) {
      this.testId = config.testId;
      this.clientId = config.clientId;
      this.loadTest();
    },
    
    loadTest: function() {
      var self = this;
      this.fetch(this.apiEndpoint + '/tests/' + this.testId + '/config')
        .then(function(config) {
          self.assignVariation(config);
          self.trackVisitor(config);
          self.setupGoalTracking(config);
        })
        .catch(function(error) {
          console.warn('A/B Test loading failed:', error);
        });
    },
    
    assignVariation: function(config) {
      var userId = this.getUserId();
      var hash = this.hashCode(userId + config.id);
      var percentage = Math.abs(hash) % 100;
      
      var cumulative = 0;
      for (var variation in config.trafficSplit) {
        cumulative += config.trafficSplit[variation];
        if (percentage < cumulative) {
          this.currentVariation = variation;
          break;
        }
      }
      
      // Store variation for consistency
      localStorage.setItem('ab_test_' + this.testId, this.currentVariation);
      
      // Apply variation
      if (config.type === 'ab' && this.currentVariation !== 'A') {
        document.body.setAttribute('data-ab-test-' + this.testId, this.currentVariation);
        this.applyVariation(config, this.currentVariation);
      }
    },
    
    applyVariation: function(config, variation) {
      // Custom CSS/JS application logic
      var variationData = config.variations[variation];
      if (variationData && variationData.css) {
        this.injectCSS(variationData.css);
      }
      if (variationData && variationData.js) {
        this.executeJS(variationData.js);
      }
    },
    
    trackVisitor: function(config) {
      this.fetch(this.apiEndpoint + '/track/visitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: this.testId,
          userId: this.getUserId(),
          variation: this.currentVariation,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          referrer: document.referrer,
          url: window.location.href
        })
      });
    },
    
    setupGoalTracking: function(config) {
      var self = this;
      
      if (config.goal.type === 'url') {
        // Track URL-based goals
        if (window.location.pathname === config.goal.value) {
          this.trackConversion();
        }
        
        // Track future navigation
        var originalPushState = history.pushState;
        history.pushState = function() {
          originalPushState.apply(history, arguments);
          setTimeout(function() {
            if (window.location.pathname === config.goal.value) {
              self.trackConversion();
            }
          }, 100);
        };
      } else if (config.goal.type === 'click') {
        // Track click-based goals
        document.addEventListener('click', function(event) {
          if (event.target.matches(config.goal.value)) {
            self.trackConversion();
          }
        });
      }
    },
    
    trackConversion: function() {
      if (this.conversionTracked) return;
      this.conversionTracked = true;
      
      this.fetch(this.apiEndpoint + '/track/conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: this.testId,
          userId: this.getUserId(),
          variation: this.currentVariation,
          timestamp: new Date().toISOString(),
          url: window.location.href
        })
      });
    },
    
    getUserId: function() {
      var userId = localStorage.getItem('ab_user_id');
      if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('ab_user_id', userId);
      }
      return userId;
    },
    
    hashCode: function(str) {
      var hash = 0;
      for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash;
    },
    
    fetch: function(url, options) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(options && options.method ? options.method : 'GET', url);
        
        if (options && options.headers) {
          for (var header in options.headers) {
            xhr.setRequestHeader(header, options.headers[header]);
          }
        }
        
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              resolve(xhr.responseText);
            }
          } else {
            reject(new Error(xhr.statusText));
          }
        };
        
        xhr.onerror = function() {
          reject(new Error('Network error'));
        };
        
        xhr.send(options && options.body ? options.body : null);
      });
    },
    
    injectCSS: function(css) {
      var style = document.createElement('style');
      style.type = 'text/css';
      style.innerHTML = css;
      document.head.appendChild(style);
    },
    
    executeJS: function(js) {
      try {
        eval(js);
      } catch (error) {
        console.warn('A/B Test JS execution failed:', error);
      }
    }
  };
  
  // Global access
  window.ABTesting = ABTesting;
  
  // Auto-initialize if config is available
  if (window.abTestConfig) {
    ABTesting.init(window.abTestConfig);
  }
})();
  `;
  
  res.send(trackingScript);
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection and server start
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync database (create tables)
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Database synchronized.');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  await sequelize.close();
  process.exit(0);
});
