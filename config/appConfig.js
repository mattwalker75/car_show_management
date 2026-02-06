// config/appConfig.js - Application configuration and file upload setup
// Manages loading/saving config.json and configures multer for image uploads.

const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Path to the config file
const configPath = path.join(__dirname, '..', 'config.json');

// Default database configuration
const defaultDatabaseConfig = {
  engine: 'sqlite',  // 'sqlite' or 'mysql'
  sqlite: {
    filename: 'carshow.db'
  },
  mysql: {
    host: 'localhost',
    port: 3306,
    database: 'carshow',
    user: 'carshow_app',
    password: 'PASSWORD',
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 100
  }
};

// Default configuration values
let appConfig = {
  port: 3001,
  sessionKeys: ['change-this-to-a-random-secret-key', 'change-this-backup-key-too'],
  database: defaultDatabaseConfig,
  appTitle: 'Car Show Manager',
  appSubtitle: 'Sign in to your account',
  judgeVotingStatus: 'Close',
  specialtyVotingStatus: 'Close',
  defaultRegistrationPrice: 25.00,
  defaultMinScore: 0,
  defaultMaxScore: 10,
  theme: 'light',
  chatEnabled: true,
  chatMessageLimit: 200,
  animatedLogin: true,
  loginBackground: {
    useImage: false,
    imageUrl: '',
    backgroundColor: '#1a1a2e',
    useTint: false,
    tintColor: '#1a1a2e',
    tintOpacity: 0.5,
    cardOpacity: 0.98
  },
  appBackground: {
    useImage: false,
    imageUrl: '',
    backgroundColor: '#1a1a2e',
    useTint: false,
    tintColor: '#1a1a2e',
    tintOpacity: 0.5,
    containerOpacity: 0.98
  }
};

// Default loginBackground settings (used for merge on load)
const defaultLoginBackground = {
  useImage: false,
  imageUrl: '',
  backgroundColor: '#1a1a2e',
  useTint: false,
  tintColor: '#1a1a2e',
  tintOpacity: 0.5,
  cardOpacity: 0.98
};

// Default appBackground settings (used for merge on load)
const defaultAppBackground = {
  useImage: false,
  imageUrl: '',
  backgroundColor: '#1a1a2e',
  useTint: false,
  tintColor: '#1a1a2e',
  tintOpacity: 0.5,
  containerOpacity: 0.98
};

// Load config from disk (called at startup and when config may have changed)
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      appConfig = JSON.parse(configData);
      // Ensure database config exists with all defaults merged
      appConfig.database = Object.assign({}, defaultDatabaseConfig, appConfig.database || {});
      appConfig.database.sqlite = Object.assign({}, defaultDatabaseConfig.sqlite, appConfig.database.sqlite || {});
      appConfig.database.mysql = Object.assign({}, defaultDatabaseConfig.mysql, appConfig.database.mysql || {});
      // Ensure loginBackground exists with all defaults merged
      appConfig.loginBackground = Object.assign({}, defaultLoginBackground, appConfig.loginBackground || {});
      // Ensure appBackground exists with all defaults merged
      appConfig.appBackground = Object.assign({}, defaultAppBackground, appConfig.appBackground || {});
    }
  } catch (err) {
    console.error('Error loading config:', err.message);
  }
}

// Save current config to disk
function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 4), 'utf8');
  } catch (err) {
    console.error('Error saving config:', err.message);
  }
}

// Load config at module initialization
loadConfig();

// Multer configuration for file uploads (profile photos, vehicle images)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

module.exports = { appConfig, loadConfig, saveConfig, upload };
