const { Sequelize, DataTypes } = require('sequelize');

// Database connection
const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/abtesting',
  {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
);

// Agency Model
const Agency = sequelize.define('Agency', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'agencies',
  timestamps: true
});

// Client Model
const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: false
  },
  apiKey: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  agencyId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      significanceThreshold: 0.95,
      minimumSampleSize: 1000,
      goals: [],
      autoStart: false,
      webhookUrl: null
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'clients',
  timestamps: true
});

// Test Model
const Test = sequelize.define('Test', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('ab', 'split_url', 'multivariate'),
    allowNull: false,
    defaultValue: 'ab'
  },
  status: {
    type: DataTypes.ENUM('draft', 'running', 'paused', 'completed', 'archived'),
    defaultValue: 'draft'
  },
  hypothesis: {
    type: DataTypes.TEXT
  },
  trafficSplit: {
    type: DataTypes.JSONB,
    defaultValue: { A: 50, B: 50 }
  },
  variations: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  goal: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  targetUrl: {
    type: DataTypes.STRING
  },
  schedule: {
    type: DataTypes.JSONB,
    defaultValue: {
      startDate: null,
      endDate: null,
      timezone: 'UTC'
    }
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      includePath: '/*',
      excludePath: null,
      deviceTargeting: 'all',
      audienceTargeting: null
    }
  },
  results: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  startedAt: {
    type: DataTypes.DATE
  },
  endedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'tests',
  timestamps: true
});

// Visitor Model
const Visitor = sequelize.define('Visitor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  variation: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userAgent: {
    type: DataTypes.TEXT
  },
  ipAddress: {
    type: DataTypes.STRING
  },
  referrer: {
    type: DataTypes.STRING
  },
  country: {
    type: DataTypes.STRING
  },
  device: {
    type: DataTypes.STRING
  },
  browser: {
    type: DataTypes.STRING
  },
  firstVisit: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'visitors',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'testId'],
      unique: true
    }
  ]
});

// Conversion Model
const Conversion = sequelize.define('Conversion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  variation: {
    type: DataTypes.STRING,
    allowNull: false
  },
  goalType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  goalValue: {
    type: DataTypes.STRING
  },
  revenue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  convertedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'conversions',
  timestamps: true
});

// UserClient Model (User membership within a client)
const UserClient = sequelize.define('UserClient', {
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  clientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'editor', 'viewer'),
    defaultValue: 'viewer'
  },
  permissions: {
    type: DataTypes.JSONB,
    defaultValue: {
      canCreateTests: false,
      canEditTests: false,
      canDeleteTests: false,
      canViewAnalytics: true,
      canManageUsers: false
    }
  }
}, {
  tableName: 'user_clients',
  timestamps: true
});

// Invitation Model
const Invitation = sequelize.define('Invitation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  role: {
    type: DataTypes.ENUM('admin', 'editor', 'viewer'),
    defaultValue: 'viewer'
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'expired'),
    defaultValue: 'pending'
  },
  invitedBy: {
    type: DataTypes.UUID,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  acceptedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'invitations',
  timestamps: true
});

// Define associations
Client.hasMany(Test, { foreignKey: 'clientId', onDelete: 'CASCADE' });
Test.belongsTo(Client, { foreignKey: 'clientId' });

Test.hasMany(Visitor, { foreignKey: 'testId', onDelete: 'CASCADE' });
Visitor.belongsTo(Test, { foreignKey: 'testId' });

Test.hasMany(Conversion, { foreignKey: 'testId', onDelete: 'CASCADE' });
Conversion.belongsTo(Test, { foreignKey: 'testId' });

Client.hasMany(Invitation, { foreignKey: 'clientId', onDelete: 'CASCADE' });
Invitation.belongsTo(Client, { foreignKey: 'clientId' });

Client.hasMany(UserClient, { foreignKey: 'clientId', onDelete: 'CASCADE' });
UserClient.belongsTo(Client, { foreignKey: 'clientId' });

Agency.hasMany(Client, { foreignKey: 'agencyId', onDelete: 'CASCADE' });
Client.belongsTo(Agency, { foreignKey: 'agencyId' });

// Export models and sequelize instance
module.exports = {
  sequelize,
  Client,
  Test,
  Visitor,
  Conversion,
  UserClient,
  Invitation,
  Agency
};
