// app.js - Complete car show voting system with authentication
const express = require('express');
const https = require('https');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cookieSession = require('cookie-session');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

const app = express();
const port = 3001;

// Load application config
const configPath = path.join(__dirname, 'config.json');
let appConfig = {
  appTitle: 'Car Show Manager',
  appSubtitle: 'Sign in to your account',
  judgeVotingLocked: false,
  specialtyVotingLocked: false
};

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      appConfig = JSON.parse(configData);
    }
  } catch (err) {
    console.error('Error loading config:', err.message);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config:', err.message);
  }
}

// Load config at startup
loadConfig();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static('images'));

// Multer configuration for file uploads
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

// Session middleware
app.use(cookieSession({
  name: 'session',
  keys: ['car-show-secret-key-2024', 'backup-secret-key'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// Database setup
const dbPath = path.join(__dirname, 'carshow.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Create specialty votes tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS specialty_votes (
      specialty_vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
      vote_name TEXT NOT NULL UNIQUE,
      description TEXT,
      allow_all_users BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS specialty_vote_voters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      specialty_vote_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id),
      FOREIGN KEY (user_id) REFERENCES users (user_id),
      UNIQUE(specialty_vote_id, user_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS specialty_vote_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      specialty_vote_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      car_id INTEGER NOT NULL,
      voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id),
      FOREIGN KEY (user_id) REFERENCES users (user_id),
      FOREIGN KEY (car_id) REFERENCES cars (car_id),
      UNIQUE(specialty_vote_id, user_id)
    )`);
    // Create judge scores table
    db.run(`CREATE TABLE IF NOT EXISTS judge_scores (
      score_id INTEGER PRIMARY KEY AUTOINCREMENT,
      judge_id INTEGER NOT NULL,
      car_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (judge_id) REFERENCES users (user_id),
      FOREIGN KEY (car_id) REFERENCES cars (car_id),
      FOREIGN KEY (question_id) REFERENCES judge_questions (judge_question_id),
      UNIQUE(judge_id, car_id, question_id)
    )`);
    // Create published results table
    db.run(`CREATE TABLE IF NOT EXISTS published_results (
      result_id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_type TEXT NOT NULL,
      class_id INTEGER,
      specialty_vote_id INTEGER,
      car_id INTEGER NOT NULL,
      place INTEGER NOT NULL,
      total_score REAL,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes (class_id),
      FOREIGN KEY (specialty_vote_id) REFERENCES specialty_votes (specialty_vote_id),
      FOREIGN KEY (car_id) REFERENCES cars (car_id)
    )`);
    // Add vehicle_id and class_id columns to specialty_votes if they don't exist
    db.run(`ALTER TABLE specialty_votes ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(vehicle_id)`, (err) => {});
    db.run(`ALTER TABLE specialty_votes ADD COLUMN class_id INTEGER REFERENCES classes(class_id)`, (err) => {});
  }
});

// Check if users table is empty
function checkInitialSetup(callback) {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Error checking users:', err);
      callback(false, null);
    } else {
      callback(row.count === 0, row.count);
    }
  });
}

// Hash password
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Verify password
function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Shared CSS styles - Mobile-first design
const styles = `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html {
      font-size: 16px;
      -webkit-text-size-adjust: 100%;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      min-height: -webkit-fill-available;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 12px;
      padding-top: env(safe-area-inset-top, 12px);
      padding-bottom: env(safe-area-inset-bottom, 12px);
    }

    .container {
      background: rgba(255, 255, 255, 0.98);
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      padding: 24px 20px;
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
    }

    .logo {
      text-align: center;
      margin-bottom: 24px;
    }

    .logo-icon {
      font-size: 56px;
      margin-bottom: 8px;
    }

    h1, h2 {
      color: #1a1a2e;
      text-align: center;
      margin-bottom: 8px;
      font-weight: 700;
    }

    h1 {
      font-size: 24px;
    }

    h2 {
      font-size: 20px;
    }

    .subtitle {
      color: #666;
      text-align: center;
      margin-bottom: 24px;
      font-size: 14px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      color: #333;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 14px;
    }

    input[type="text"],
    input[type="email"],
    input[type="password"] {
      width: 100%;
      padding: 16px;
      border: 2px solid #e1e1e1;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.2s ease;
      background: #f8f9fa;
      -webkit-appearance: none;
      appearance: none;
    }

    input[type="text"]:focus,
    input[type="email"]:focus,
    input[type="password"]:focus {
      border-color: #e94560;
      outline: none;
      background: #fff;
      box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
    }

    button[type="submit"] {
      width: 100%;
      padding: 18px;
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 1px;
      -webkit-appearance: none;
      appearance: none;
      min-height: 54px;
    }

    button[type="submit"]:active {
      transform: scale(0.98);
      opacity: 0.9;
    }

    .error-message {
      background: #fff5f5;
      color: #e94560;
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      border: 1px solid #fed7d7;
      font-size: 14px;
      text-align: center;
    }

    .success-message {
      background: #f0fff4;
      color: #38a169;
      padding: 14px 16px;
      border-radius: 12px;
      margin-bottom: 16px;
      border: 1px solid #c6f6d5;
      font-size: 14px;
      text-align: center;
    }

    .links {
      text-align: center;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e1e1e1;
    }

    .links a {
      color: #e94560;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      padding: 12px;
      display: inline-block;
      min-height: 44px;
      line-height: 20px;
    }

    .links a:active {
      opacity: 0.7;
    }

    /* Dashboard styles - Mobile optimized */
    .dashboard-container {
      max-width: 100%;
      padding: 16px;
    }

    .dashboard-header {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e1e1e1;
    }

    .dashboard-header h1 {
      text-align: center;
      font-size: 20px;
      margin-bottom: 0;
    }

    .user-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .user-avatar {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 18px;
      flex-shrink: 0;
    }

    .logout-btn {
      background: #f8f9fa;
      color: #666;
      padding: 12px 20px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s ease;
      border: 2px solid #e1e1e1;
      min-height: 44px;
      display: flex;
      align-items: center;
    }

    .logout-btn:active {
      background: #e94560;
      color: white;
      border-color: #e94560;
    }

    .welcome-card {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 20px;
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .welcome-card h2 {
      color: white;
      text-align: left;
      font-size: 22px;
      margin-bottom: 8px;
    }

    .welcome-card p {
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      line-height: 1.4;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .stat-card {
      background: #f8f9fa;
      padding: 20px 16px;
      border-radius: 14px;
      text-align: center;
    }

    .stat-number {
      font-size: 32px;
      font-weight: 700;
      color: #e94560;
      margin-bottom: 4px;
    }

    .stat-label {
      color: #666;
      font-size: 12px;
      font-weight: 600;
    }

    /* Tablet and larger screens */
    @media (min-width: 768px) {
      body {
        padding: 20px;
        align-items: center;
      }

      .container {
        padding: 40px;
        border-radius: 20px;
      }

      .dashboard-container {
        max-width: 900px;
        padding: 40px;
      }

      .dashboard-header {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }

      .dashboard-header h1 {
        text-align: left;
        font-size: 24px;
      }

      h1 {
        font-size: 28px;
      }

      h2 {
        font-size: 24px;
      }

      .welcome-card {
        padding: 30px;
      }

      .welcome-card h2 {
        font-size: 28px;
      }

      .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 20px;
      }

      .stat-card {
        padding: 25px;
      }

      .stat-number {
        font-size: 36px;
      }

      .stat-label {
        font-size: 14px;
      }

      button[type="submit"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 30px rgba(233, 69, 96, 0.4);
      }

      .logout-btn:hover {
        background: #e94560;
        color: white;
        border-color: #e94560;
      }
    }
  </style>
`;

// Routes
app.get('/', (req, res) => {
  checkInitialSetup((isEmpty, count) => {
    if (isEmpty) {
      // Initial setup - ask for admin user
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Car Show Setup</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
              <p class="subtitle">Initial Setup - Create Admin Account</p>
            </div>
            <form method="POST" action="/create-admin">
              <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" required placeholder="Enter username">
              </div>
              <div class="form-group">
                <label>Full Name</label>
                <input type="text" name="name" required placeholder="Enter your name">
              </div>
              <div class="form-group">
                <label>Email Address</label>
                <input type="email" name="email" required placeholder="Enter email">
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" required placeholder="Create password">
              </div>
              <div class="form-group">
                <label>Confirm Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm password">
              </div>
              <button type="submit">Create Admin Account</button>
            </form>
          </div>
        </body>
        </html>
      `);
    } else {
      // Regular login
      res.redirect('/login');
    }
  });
});

// Create admin user
app.post('/create-admin', (req, res) => {
  const { username, name, email, password, confirm_password } = req.body;

  // Check if passwords match
  if (password !== confirm_password) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Car Show Setup</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
            <p class="subtitle">Initial Setup - Create Admin Account</p>
          </div>
          <div class="error-message">Passwords do not match!</div>
          <form method="POST" action="/create-admin">
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="username" required placeholder="Enter username">
            </div>
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" name="name" required placeholder="Enter your name">
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" name="email" required placeholder="Enter email">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" required placeholder="Create password">
            </div>
            <div class="form-group">
              <label>Confirm Password</label>
              <input type="password" name="confirm_password" required placeholder="Confirm password">
            </div>
            <button type="submit">Create Admin Account</button>
          </form>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const hashedPassword = hashPassword(password);

  db.run('INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [username, name, email, hashedPassword, 'admin'],
    function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Car Show Setup</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error creating admin user: ${err.message}</div>
              <div class="links">
                <a href="/">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        // Generate recovery token for admin password recovery
        const recoveryToken = crypto.randomBytes(32).toString('hex');
        const recoveryTokenHash = crypto.createHash('sha256').update(recoveryToken).digest('hex');

        // Save the hashed token to a file
        const recoveryFilePath = path.join(__dirname, 'admin_recovery_token.txt');
        fs.writeFileSync(recoveryFilePath, recoveryTokenHash, 'utf8');

        // Build the recovery URL
        const recoveryUrl = `https://localhost:${port}/admin/recover?token=${recoveryToken}`;

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Car Show Setup</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            <style>
              .recovery-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
              }
              .recovery-modal-content {
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 90%;
                width: 500px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              }
              .recovery-modal h2 {
                color: #e74c3c;
                margin-bottom: 15px;
              }
              .recovery-modal p {
                color: #333;
                margin-bottom: 20px;
                line-height: 1.6;
              }
              .recovery-url-box {
                background: #f8f9fa;
                border: 2px solid #e74c3c;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                word-break: break-all;
                font-family: monospace;
                font-size: 12px;
                color: #333;
                text-align: left;
              }
              .copy-btn {
                background: #3498db;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                margin-right: 10px;
                font-size: 14px;
              }
              .copy-btn:hover {
                background: #2980b9;
              }
              .proceed-btn {
                background: #27ae60;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                text-decoration: none;
                display: inline-block;
              }
              .proceed-btn:hover {
                background: #219a52;
              }
              .warning-icon {
                font-size: 48px;
                margin-bottom: 15px;
              }
            </style>
          </head>
          <body>
            <div class="recovery-modal">
              <div class="recovery-modal-content">
                <div class="warning-icon">⚠️</div>
                <h2>IMPORTANT: Save This Recovery URL!</h2>
                <p>Your admin account has been created successfully. Below is your <strong>one-time recovery URL</strong>. If you ever forget your admin password, you can use this URL to create a new admin account.</p>
                <p><strong style="color: #e74c3c;">Save this URL in a safe location NOW. You will NOT see it again!</strong></p>
                <div class="recovery-url-box" id="recoveryUrl">${recoveryUrl}</div>
                <div style="margin-top: 20px;">
                  <button class="copy-btn" onclick="copyUrl()">📋 Copy URL</button>
                  <a href="/login" class="proceed-btn">✓ I've Saved It - Proceed to Login</a>
                </div>
              </div>
            </div>
            <script>
              function copyUrl() {
                const urlText = document.getElementById('recoveryUrl').innerText;
                navigator.clipboard.writeText(urlText).then(() => {
                  alert('Recovery URL copied to clipboard!');
                }).catch(() => {
                  // Fallback for older browsers
                  const textArea = document.createElement('textarea');
                  textArea.value = urlText;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  alert('Recovery URL copied to clipboard!');
                });
              }
            </script>
          </body>
          </html>
        `);
      }
    });
});

// Admin recovery - validate token and show admin creation form
app.get('/admin/recover', (req, res) => {
  const { token } = req.query;

  if (!token) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Recovery</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">No recovery token provided.</div>
          <div class="links">
            <a href="/login">Return to Login</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Read the saved token hash from file
  const recoveryFilePath = path.join(__dirname, 'admin_recovery_token.txt');

  if (!fs.existsSync(recoveryFilePath)) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Recovery</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Recovery token not configured. Please contact system administrator.</div>
          <div class="links">
            <a href="/login">Return to Login</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const savedTokenHash = fs.readFileSync(recoveryFilePath, 'utf8').trim();
  const providedTokenHash = crypto.createHash('sha256').update(token).digest('hex');

  if (savedTokenHash !== providedTokenHash) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Recovery</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Invalid recovery token. Access denied.</div>
          <div class="links">
            <a href="/login">Return to Login</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Token is valid - show admin creation form
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Recovery</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>Car Show Manager</h1>
          <p class="subtitle">Admin Account Recovery</p>
        </div>
        <div class="success-message" style="background: #fff3cd; color: #856404; border-color: #ffeeba;">
          Recovery token validated. Create a new admin account below.
        </div>
        <form method="POST" action="/admin/recover">
          <input type="hidden" name="token" value="${token}">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Enter username">
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" required placeholder="Enter your name">
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" required placeholder="Enter email">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Create password">
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirm_password" required placeholder="Confirm password">
          </div>
          <button type="submit">Create New Admin Account</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Admin recovery - create new admin account
app.post('/admin/recover', (req, res) => {
  const { token, username, name, email, password, confirm_password } = req.body;

  // Verify token again
  const recoveryFilePath = path.join(__dirname, 'admin_recovery_token.txt');

  if (!token || !fs.existsSync(recoveryFilePath)) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Recovery</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Invalid recovery request.</div>
          <div class="links">
            <a href="/login">Return to Login</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const savedTokenHash = fs.readFileSync(recoveryFilePath, 'utf8').trim();
  const providedTokenHash = crypto.createHash('sha256').update(token).digest('hex');

  if (savedTokenHash !== providedTokenHash) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Recovery</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Invalid recovery token. Access denied.</div>
          <div class="links">
            <a href="/login">Return to Login</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Check if passwords match
  if (password !== confirm_password) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Recovery</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
            <p class="subtitle">Admin Account Recovery</p>
          </div>
          <div class="error-message">Passwords do not match!</div>
          <form method="POST" action="/admin/recover">
            <input type="hidden" name="token" value="${token}">
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="username" required placeholder="Enter username">
            </div>
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" name="name" required placeholder="Enter your name">
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" name="email" required placeholder="Enter email">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" required placeholder="Create password">
            </div>
            <div class="form-group">
              <label>Confirm Password</label>
              <input type="password" name="confirm_password" required placeholder="Confirm password">
            </div>
            <button type="submit">Create New Admin Account</button>
          </form>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const hashedPassword = hashPassword(password);

  // Insert new admin user
  db.run('INSERT INTO users (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [username, name, email, hashedPassword, 'admin'],
    function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Admin Recovery</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error creating admin user: ${err.message}</div>
              <div class="links">
                <a href="/admin/recover?token=${token}">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        // Generate a new recovery token for the new admin
        const newRecoveryToken = crypto.randomBytes(32).toString('hex');
        const newRecoveryTokenHash = crypto.createHash('sha256').update(newRecoveryToken).digest('hex');
        fs.writeFileSync(recoveryFilePath, newRecoveryTokenHash, 'utf8');

        const newRecoveryUrl = `https://localhost:${port}/admin/recover?token=${newRecoveryToken}`;

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Admin Recovery</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            <style>
              .recovery-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
              }
              .recovery-modal-content {
                background: white;
                padding: 30px;
                border-radius: 12px;
                max-width: 90%;
                width: 500px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              }
              .recovery-modal h2 {
                color: #e74c3c;
                margin-bottom: 15px;
              }
              .recovery-modal p {
                color: #333;
                margin-bottom: 20px;
                line-height: 1.6;
              }
              .recovery-url-box {
                background: #f8f9fa;
                border: 2px solid #e74c3c;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                word-break: break-all;
                font-family: monospace;
                font-size: 12px;
                color: #333;
                text-align: left;
              }
              .copy-btn {
                background: #3498db;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                margin-right: 10px;
                font-size: 14px;
              }
              .copy-btn:hover {
                background: #2980b9;
              }
              .proceed-btn {
                background: #27ae60;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                text-decoration: none;
                display: inline-block;
              }
              .proceed-btn:hover {
                background: #219a52;
              }
              .warning-icon {
                font-size: 48px;
                margin-bottom: 15px;
              }
            </style>
          </head>
          <body>
            <div class="recovery-modal">
              <div class="recovery-modal-content">
                <div class="warning-icon">⚠️</div>
                <h2>Admin Account Created - NEW Recovery URL!</h2>
                <p>Your new admin account has been created. A <strong>new recovery URL</strong> has been generated. The old recovery URL is no longer valid.</p>
                <p><strong style="color: #e74c3c;">Save this new URL in a safe location NOW. You will NOT see it again!</strong></p>
                <div class="recovery-url-box" id="recoveryUrl">${newRecoveryUrl}</div>
                <div style="margin-top: 20px;">
                  <button class="copy-btn" onclick="copyUrl()">Copy URL</button>
                  <a href="/login" class="proceed-btn">I've Saved It - Proceed to Login</a>
                </div>
              </div>
            </div>
            <script>
              function copyUrl() {
                const urlText = document.getElementById('recoveryUrl').innerText;
                navigator.clipboard.writeText(urlText).then(() => {
                  alert('Recovery URL copied to clipboard!');
                }).catch(() => {
                  const textArea = document.createElement('textarea');
                  textArea.value = urlText;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  alert('Recovery URL copied to clipboard!');
                });
              }
            </script>
          </body>
          </html>
        `);
      }
    });
});

// Login page
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${appConfig.appTitle} - Login</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>${appConfig.appTitle}</h1>
          ${appConfig.appSubtitle ? `<p class="subtitle">${appConfig.appSubtitle}</p>` : ''}
        </div>
        <form method="POST" action="/login">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Enter username">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Enter password">
          </div>
          <button type="submit">Sign In</button>
        </form>
        <div class="links">
          <a href="/register">Create an Account</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const renderLoginError = (message) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${appConfig.appTitle} - Login</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>${appConfig.appTitle}</h1>
          ${appConfig.appSubtitle ? `<p class="subtitle">${appConfig.appSubtitle}</p>` : ''}
        </div>
        <div class="error-message">${message}</div>
        <form method="POST" action="/login">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Enter username">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Enter password">
          </div>
          <button type="submit">Sign In</button>
        </form>
        <div class="links">
          <a href="/register">Create an Account</a>
        </div>
      </div>
    </body>
    </html>
  `;

  db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
    if (err) {
      res.send(renderLoginError('Login error. Please try again.'));
      return;
    }

    if (!user) {
      res.send(renderLoginError('Invalid username or password'));
      return;
    }

    if (verifyPassword(password, user.password_hash)) {
      // Successful login
      req.session = { user: user };
      // Redirect based on role
      if (user.role === 'admin') {
        res.redirect('/admin');
      } else if (user.role === 'judge') {
        res.redirect('/judge');
      } else if (user.role === 'registrar') {
        res.redirect('/registrar');
      } else {
        res.redirect('/user');
      }
    } else {
      res.send(renderLoginError('Invalid username or password'));
    }
  });
});

// Registration page
app.get('/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Register - Car Show</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>Car Show Manager</h1>
          <p class="subtitle">Create your account</p>
        </div>
        <form method="POST" action="/register">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Choose a username">
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" required placeholder="Enter your name">
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" required placeholder="Enter email">
          </div>
          <div class="form-group">
            <label>Phone (Optional)</label>
            <input type="text" name="phone" placeholder="Enter phone number">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Create password">
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirm_password" required placeholder="Confirm password">
          </div>
          <button type="submit">Create Account</button>
        </form>
        <div class="links">
          <a href="/login">Already have an account? Sign In</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Handle registration
app.post('/register', (req, res) => {
  const { username, name, email, phone, password, confirm_password } = req.body;

  const renderRegisterError = (message, formData = {}) => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Register - Car Show</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-icon">🏎️</div>
          <h1>Car Show Manager</h1>
          <p class="subtitle">Create your account</p>
        </div>
        <div class="error-message">${message}</div>
        <form method="POST" action="/register">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Choose a username" value="${formData.username || ''}">
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" required placeholder="Enter your name" value="${formData.name || ''}">
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" required placeholder="Enter email" value="${formData.email || ''}">
          </div>
          <div class="form-group">
            <label>Phone (Optional)</label>
            <input type="text" name="phone" placeholder="Enter phone number" value="${formData.phone || ''}">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Create password">
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirm_password" required placeholder="Confirm password">
          </div>
          <button type="submit">Create Account</button>
        </form>
        <div class="links">
          <a href="/login">Already have an account? Sign In</a>
        </div>
      </div>
    </body>
    </html>
  `;

  // Check if passwords match
  if (password !== confirm_password) {
    res.send(renderRegisterError('Passwords do not match!', { username, name, email, phone }));
    return;
  }

  const hashedPassword = hashPassword(password);

  db.run('INSERT INTO users (username, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
    [username, name, email, phone, hashedPassword, 'user'],
    function(err) {
      if (err) {
        res.send(renderRegisterError('Error registering user: ' + err.message, { username, name, email, phone }));
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Registration Success - Car Show</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Account created successfully!</div>
              <p style="text-align: center; color: #666; margin-bottom: 20px;">Welcome to Car Show Manager. You can now sign in.</p>
              <div class="links">
                <a href="/login">Proceed to Sign In</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
});

// Admin page styles (additional) - Mobile optimized
const adminStyles = `
  <style>
    /* Mobile-first admin navigation */
    .admin-nav {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .admin-nav a {
      flex: 1;
      min-width: calc(50% - 4px);
      padding: 14px 16px;
      background: #f8f9fa;
      border: 2px solid #e1e1e1;
      border-radius: 10px;
      text-decoration: none;
      color: #333;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .admin-nav a.active {
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
      color: white;
      border-color: #e94560;
    }

    .admin-nav a:active {
      transform: scale(0.98);
      opacity: 0.9;
    }

    /* Table wrapper for horizontal scroll on mobile */
    .table-wrapper {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-top: 15px;
      border-radius: 10px;
      border: 1px solid #e1e1e1;
    }

    .user-table {
      width: 100%;
      min-width: 600px;
      border-collapse: collapse;
    }

    .user-table th, .user-table td {
      padding: 12px 10px;
      text-align: left;
      border-bottom: 1px solid #e1e1e1;
      white-space: nowrap;
      font-size: 14px;
    }

    .user-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #333;
      position: sticky;
      top: 0;
    }

    .user-table tr:active {
      background: #f0f0f0;
    }

    /* Mobile card view for users (alternative to table) */
    .user-cards {
      display: none;
    }

    .user-card {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      border: 1px solid #e1e1e1;
    }

    .user-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .user-card-name {
      font-weight: 600;
      font-size: 16px;
      color: #1a1a2e;
    }

    .user-card-username {
      font-size: 13px;
      color: #666;
    }

    .user-card-details {
      font-size: 14px;
      color: #555;
      margin-bottom: 12px;
    }

    .user-card-details div {
      margin-bottom: 4px;
    }

    .user-card-badges {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .user-card-actions {
      display: flex;
      gap: 10px;
    }

    /* Larger touch targets for action buttons */
    .action-btn {
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      min-width: 70px;
    }

    .action-btn.edit {
      background: #3498db;
      color: white;
    }

    .action-btn.delete {
      background: #e74c3c;
      color: white;
    }

    .action-btn:active {
      opacity: 0.8;
      transform: scale(0.98);
    }

    /* Full-width action buttons in card view */
    .user-card-actions .action-btn {
      flex: 1;
    }

    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    }

    .modal {
      background: white;
      padding: 24px;
      border-radius: 15px;
      max-width: 500px;
      width: 100%;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .modal h3 {
      margin-bottom: 20px;
      color: #1a1a2e;
      font-size: 18px;
    }

    .role-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      display: inline-block;
    }

    .role-badge.admin {
      background: #e94560;
      color: white;
    }

    .role-badge.judge {
      background: #3498db;
      color: white;
    }

    .role-badge.registrar {
      background: #9b59b6;
      color: white;
    }

    .role-badge.user {
      background: #27ae60;
      color: white;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      display: inline-block;
    }

    .status-badge.active {
      background: #d4edda;
      color: #155724;
    }

    .status-badge.inactive {
      background: #f8d7da;
      color: #721c24;
    }

    select {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e1e1e1;
      border-radius: 10px;
      font-size: 16px;
      background: #f8f9fa;
      cursor: pointer;
      min-height: 50px;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 16px center;
    }

    select:focus {
      border-color: #e94560;
      outline: none;
      background-color: #fff;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
      padding: 14px 24px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      font-size: 16px;
      min-height: 50px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn-secondary:active {
      opacity: 0.8;
    }

    .section-title {
      font-size: 18px;
      color: #1a1a2e;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e1e1e1;
    }

    .profile-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 15px;
      margin-bottom: 16px;
    }

    .profile-card h3 {
      margin-bottom: 15px;
      color: #1a1a2e;
      font-size: 16px;
    }

    /* Form buttons stacked on mobile */
    .form-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 20px;
    }

    .form-actions button,
    .form-actions a {
      width: 100%;
      text-align: center;
    }

    /* Scroll hint for tables */
    .scroll-hint {
      display: block;
      text-align: center;
      color: #888;
      font-size: 12px;
      margin-top: 8px;
      padding: 8px;
    }

    .scroll-hint::before {
      content: "← Scroll to see more →";
    }

    /* Tablet and up - hide card view, show table */
    @media (min-width: 768px) {
      .admin-nav a {
        flex: 0 0 auto;
        min-width: auto;
        padding: 12px 24px;
      }

      .admin-nav a:hover {
        background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
        color: white;
        border-color: #e94560;
      }

      .table-wrapper {
        overflow-x: visible;
        border: none;
      }

      .user-table {
        min-width: 100%;
      }

      .user-table th, .user-table td {
        padding: 12px 15px;
        font-size: 14px;
      }

      .user-table tr:hover {
        background: #f8f9fa;
      }

      .action-btn {
        padding: 8px 14px;
        font-size: 13px;
        min-height: 36px;
        min-width: auto;
        margin-right: 5px;
      }

      .action-btn:hover {
        opacity: 0.85;
      }

      .scroll-hint {
        display: none;
      }

      .modal {
        padding: 30px;
      }

      .section-title {
        font-size: 20px;
      }

      .profile-card {
        padding: 25px;
      }

      .form-actions {
        flex-direction: row;
        justify-content: flex-start;
      }

      .form-actions button,
      .form-actions a {
        width: auto;
      }
    }

    /* Small phones - show card view instead of table */
    @media (max-width: 480px) {
      .table-wrapper {
        display: none;
      }

      .scroll-hint {
        display: none;
      }

      .user-cards {
        display: block;
      }

      .section-title {
        font-size: 16px;
      }
    }
  </style>
`;

// Require admin role middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Require judge role middleware
function requireJudge(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'judge') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Require registrar role middleware
function requireRegistrar(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'registrar') {
    next();
  } else {
    res.redirect('/login');
  }
}

// Admin page
app.get('/admin', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.all('SELECT user_id as id, username, name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC', (err, users) => {
    if (err) {
      users = [];
    }

    const userRows = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <a href="/admin/edit-user/${u.id}" class="action-btn edit">Edit</a>
          ${u.id !== user.user_id ? `<a href="/admin/delete-user/${u.id}" class="action-btn delete" onclick="return confirm('Are you sure you want to delete this user?')">Delete</a>` : ''}
        </td>
      </tr>
    `).join('');

    // Mobile card view for small screens
    const userCards = users.map(u => `
      <div class="user-card">
        <div class="user-card-header">
          <div>
            <div class="user-card-name">${u.name}</div>
            <div class="user-card-username">@${u.username}</div>
          </div>
        </div>
        <div class="user-card-details">
          <div>${u.email}</div>
        </div>
        <div class="user-card-badges">
          <span class="role-badge ${u.role}">${u.role}</span>
          <span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="user-card-actions">
          <a href="/admin/edit-user/${u.id}" class="action-btn edit">Edit</a>
          ${u.id !== user.user_id ? `<a href="/admin/delete-user/${u.id}" class="action-btn delete" onclick="return confirm('Are you sure you want to delete this user?')">Delete</a>` : ''}
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Dashboard - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="welcome-card">
            <h2>Welcome, ${user.name}!</h2>
            <p>Manage users, judges, and system settings.</p>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin" class="active">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">All Users</h3>

          <!-- Mobile card view -->
          <div class="user-cards">
            ${userCards}
          </div>

          <!-- Table view for larger screens -->
          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${userRows}
              </tbody>
            </table>
          </div>
          <div class="scroll-hint"></div>

          <div style="margin-top:20px;text-align:center;">
            <a href="/admin/add-user" class="action-btn edit" style="display:inline-block;padding:12px 24px;font-size:16px;">Add User</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Admin add user page
app.get('/admin/add-user', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Add User - Admin Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
      ${adminStyles}
    </head>
    <body>
      <div class="container dashboard-container">
        <div class="dashboard-header">
          <h1>🏎️ Admin Dashboard</h1>
          <div class="user-info">
            <div class="user-avatar">${avatarContent}</div>
            <a href="/logout" class="logout-btn">Sign Out</a>
          </div>
        </div>

        <div class="admin-nav">
          <a href="/admin/app-config">App Config</a>
          <a href="/admin/vehicle-config">Vehicle Config</a>
          <a href="/admin/categories">Judge Config</a>
          <a href="/admin/specialty-votes">Special Vote Config</a>
          <a href="/admin">Users</a>
          <a href="/admin/vehicles">Cars</a>
          <a href="/admin/judge-status">Judge Status</a>
          <a href="/admin/vote-status">Vote Status</a>
          <a href="/admin/reports">Reports</a>
          <a href="/admin/profile">Profile</a>
        </div>

        <h3 class="section-title">Add New User</h3>
        <form method="POST" action="/admin/add-user">
          <div class="form-group">
            <label>Username</label>
            <input type="text" name="username" required placeholder="Enter username">
          </div>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" required placeholder="Enter full name">
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" required placeholder="Enter email">
          </div>
          <div class="form-group">
            <label>Phone (Optional)</label>
            <input type="text" name="phone" placeholder="Enter phone number">
          </div>
          <div class="form-group">
            <label>Role</label>
            <select name="role" required>
              <option value="user">User</option>
              <option value="judge">Judge</option>
              <option value="registrar">Registrar</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required placeholder="Enter password">
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirm_password" required placeholder="Confirm password">
          </div>
          <button type="submit">Create User</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Handle admin add user
app.post('/admin/add-user', requireAdmin, (req, res) => {
  const { username, name, email, phone, role, password, confirm_password } = req.body;

  if (password !== confirm_password) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Add User - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Passwords do not match!</div>
          <div class="links">
            <a href="/admin/add-user">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const hashedPassword = hashPassword(password);

  db.run('INSERT INTO users (username, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
    [username, name, email, phone, hashedPassword, role],
    function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Add User - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error creating user: ${err.message}</div>
              <div class="links">
                <a href="/admin/add-user">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.redirect('/admin');
      }
    });
});

// Admin edit user page
app.get('/admin/edit-user/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;
  const userId = req.params.id;

  db.get('SELECT user_id as id, username, name, email, phone, role, is_active FROM users WHERE user_id = ?', [userId], (err, editUser) => {
    if (err || !editUser) {
      res.redirect('/admin');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit User - Admin Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">Edit User: ${editUser.username}</h3>
          <form method="POST" action="/admin/edit-user/${editUser.id}">
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="username" required value="${editUser.username}">
            </div>
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" name="name" required value="${editUser.name}">
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" name="email" required value="${editUser.email}">
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="text" name="phone" value="${editUser.phone || ''}">
            </div>
            <div class="form-group">
              <label>Role</label>
              <select name="role" required>
                <option value="user" ${editUser.role === 'user' ? 'selected' : ''}>User</option>
                <option value="judge" ${editUser.role === 'judge' ? 'selected' : ''}>Judge</option>
                <option value="registrar" ${editUser.role === 'registrar' ? 'selected' : ''}>Registrar</option>
                <option value="admin" ${editUser.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="is_active" required>
                <option value="1" ${editUser.is_active ? 'selected' : ''}>Active</option>
                <option value="0" ${!editUser.is_active ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
            <div class="form-group">
              <label>New Password (leave blank to keep current)</label>
              <input type="password" name="password" placeholder="Enter new password">
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" name="confirm_password" placeholder="Confirm new password">
            </div>
            <button type="submit">Update User</button>
          </form>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle admin edit user
app.post('/admin/edit-user/:id', requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { username, name, email, phone, role, is_active, password, confirm_password } = req.body;

  // Check if password change is requested
  if (password && password !== confirm_password) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit User - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Passwords do not match!</div>
          <div class="links">
            <a href="/admin/edit-user/${userId}">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (password) {
    // Update with new password
    const hashedPassword = hashPassword(password);
    db.run('UPDATE users SET username = ?, name = ?, email = ?, phone = ?, role = ?, is_active = ?, password_hash = ? WHERE user_id = ?',
      [username, name, email, phone, role, is_active, hashedPassword, userId],
      function(err) {
        if (err) {
          res.send(`<div class="error-message">Error updating user: ${err.message}</div><a href="/admin">Back</a>`);
        } else {
          res.redirect('/admin');
        }
      });
  } else {
    // Update without password change
    db.run('UPDATE users SET username = ?, name = ?, email = ?, phone = ?, role = ?, is_active = ? WHERE user_id = ?',
      [username, name, email, phone, role, is_active, userId],
      function(err) {
        if (err) {
          res.send(`<div class="error-message">Error updating user: ${err.message}</div><a href="/admin">Back</a>`);
        } else {
          res.redirect('/admin');
        }
      });
  }
});

// Admin delete user
app.get('/admin/delete-user/:id', requireAdmin, (req, res) => {
  const userId = req.params.id;
  const currentUser = req.session.user;

  // Prevent self-deletion
  if (parseInt(userId) === currentUser.user_id) {
    res.redirect('/admin');
    return;
  }

  db.run('DELETE FROM users WHERE user_id = ?', [userId], function(err) {
    res.redirect('/admin');
  });
});

// Admin profile page
app.get('/admin/profile', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get fresh user data from database
  db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
    if (err || !currentUser) {
      res.redirect('/admin');
      return;
    }

    const profileImageHtml = currentUser.image_url
      ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
      : `<div class="profile-image-placeholder">${initials}</div>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Profile - Admin Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .profile-image-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }
          .profile-image, .profile-image-placeholder {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 15px;
            border: 4px solid #e94560;
          }
          .profile-image-placeholder {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 42px;
            font-weight: 700;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${currentUser.image_url ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile" class="active">Profile</a>
          </div>

          <div class="profile-card">
            <h3>Profile Picture</h3>
            <div class="profile-image-container">
              ${profileImageHtml}
            </div>
            <form method="POST" action="/admin/upload-photo" enctype="multipart/form-data">
              <div class="form-group">
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    Click or tap to select an image<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
                <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin-top:10px;border-radius:8px;border:2px solid #e1e1e1;">
              </div>
              <button type="submit">Upload Photo</button>
            </form>
            <script>
              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                const preview = document.getElementById('imagePreview');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                  const reader = new FileReader();
                  reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                  };
                  reader.readAsDataURL(input.files[0]);
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                  preview.style.display = 'none';
                  preview.src = '';
                }
              }
            </script>
          </div>

          <div class="profile-card">
            <h3>Update Email</h3>
            <form method="POST" action="/admin/update-email">
              <div class="form-group">
                <label>Current Email</label>
                <input type="email" value="${currentUser.email}" disabled>
              </div>
              <div class="form-group">
                <label>New Email Address</label>
                <input type="email" name="email" required placeholder="Enter new email">
              </div>
              <button type="submit">Update Email</button>
            </form>
          </div>

          <div class="profile-card">
            <h3>Change Password</h3>
            <form method="POST" action="/admin/change-password">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="current_password" required placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="new_password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle admin profile photo upload
app.post('/admin/upload-photo', requireAdmin, upload.single('profile_photo'), async (req, res) => {
  const user = req.session.user;

  if (!req.file) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Please select an image file to upload.</div>
          <div class="links">
            <a href="/admin/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(__dirname, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    db.get('SELECT image_url FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        const oldPath = path.join(__dirname, row.image_url);
        fs.unlink(oldPath, () => {});
      }

      db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, user.user_id], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Upload Photo - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error saving photo: ${err.message}</div>
                <div class="links">
                  <a href="/admin/profile">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          req.session.user.image_url = imageUrl;
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Photo Uploaded</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Profile photo uploaded successfully!</div>
                <div class="links">
                  <a href="/admin/profile">Back to Profile</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Error processing image: ${error.message}</div>
          <div class="links">
            <a href="/admin/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Handle admin email update
app.post('/admin/update-email', requireAdmin, (req, res) => {
  const user = req.session.user;
  const { email } = req.body;

  db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Email - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating email: ${err.message}</div>
            <div class="links">
              <a href="/admin/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      req.session.user.email = email;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Updated</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="success-message">Email updated successfully!</div>
            <div class="links">
              <a href="/admin/profile">Back to Profile</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Handle admin password change
app.post('/admin/change-password', requireAdmin, (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
    if (err || !row) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error retrieving user data.</div>
            <div class="links">
              <a href="/admin/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (!verifyPassword(current_password, row.password_hash)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Current password is incorrect.</div>
            <div class="links">
              <a href="/admin/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (new_password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">New passwords do not match.</div>
            <div class="links">
              <a href="/admin/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.user_id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating password: ${err.message}</div>
              <div class="links">
                <a href="/admin/profile">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Changed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password changed successfully!</div>
              <div class="links">
                <a href="/admin/profile">Back to Profile</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Admin vehicles page - view all vehicles
app.get('/admin/vehicles', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all vehicles with owner info and class names
  db.all(`SELECT c.car_id, c.make, c.model, c.description, c.image_url, c.voter_id, c.is_active, c.created_at,
          u.name as owner_name, u.username as owner_username,
          cl.class_name, v.vehicle_name
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          LEFT JOIN classes cl ON c.class_id = cl.class_id
          LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
          ORDER BY c.created_at DESC`, (err, cars) => {
    if (err) {
      cars = [];
    }

    const vehicleCards = cars.map(car => `
      <div class="vehicle-card ${car.is_active ? '' : 'inactive'}">
        <div class="vehicle-image">
          ${car.image_url
            ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
            : `<div class="vehicle-placeholder">🚗</div>`
          }
        </div>
        <div class="vehicle-info">
          <div class="vehicle-title">${car.make} ${car.model}</div>
          <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'} (@${car.owner_username || 'N/A'})</div>
          <div class="vehicle-class">
            ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
            ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
            <span class="status-badge ${car.is_active ? 'active' : 'inactive'}">${car.is_active ? 'Active' : 'Inactive'}</span>
            ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
          </div>
          ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
        </div>
        <div class="vehicle-actions">
          <a href="/admin/edit-vehicle/${car.car_id}" class="action-btn edit">Edit</a>
          <a href="/admin/delete-vehicle/${car.car_id}" class="action-btn delete" onclick="return confirm('Are you sure you want to permanently delete this vehicle?')">Delete</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Manage Vehicles - Admin Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #e1e1e1;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .vehicle-card.inactive {
            opacity: 0.6;
            border-style: dashed;
          }
          .vehicle-image {
            width: 100%;
            height: 120px;
            border-radius: 8px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }
          .vehicle-info {
            flex: 1;
          }
          .vehicle-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 4px;
          }
          .vehicle-meta {
            font-size: 12px;
            color: #888;
            margin-bottom: 8px;
          }
          .vehicle-class {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 8px;
          }
          .type-badge {
            background: #3498db;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .class-badge {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.active {
            background: #27ae60;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.inactive {
            background: #e74c3c;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .voter-badge {
            background: #9b59b6;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .vehicle-description {
            font-size: 13px;
            color: #666;
            line-height: 1.4;
          }
          .vehicle-actions {
            display: flex;
            gap: 8px;
          }
          @media (min-width: 768px) {
            .vehicle-card {
              flex-direction: row;
              align-items: center;
            }
            .vehicle-image {
              width: 150px;
              height: 100px;
              flex-shrink: 0;
            }
            .vehicle-actions {
              flex-shrink: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles" class="active">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">All Vehicles (${cars.length})</h3>

          ${cars.length > 0 ? vehicleCards : '<p style="color: #666; text-align: center; padding: 20px;">No vehicles registered yet.</p>'}
        </div>
      </body>
      </html>
    `);
  });
});

// Admin edit vehicle page
app.get('/admin/edit-vehicle/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT c.*, u.name as owner_name, u.username as owner_username
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          WHERE c.car_id = ?`, [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/admin/vehicles');
      return;
    }

    // Get active vehicles and classes from database
    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      db.all(`SELECT c.class_id, c.class_name, c.vehicle_id, v.vehicle_name
              FROM classes c
              JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              WHERE c.is_active = 1 AND v.is_active = 1
              ORDER BY v.vehicle_name, c.class_name`, (err, classes) => {
        if (err) classes = [];

        const vehicleOptionsHtml = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}" ${car.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
        ).join('');

        // Filter classes for the current vehicle type
        const currentClasses = classes.filter(c => c.vehicle_id == car.vehicle_id);
        const classOptionsHtml = currentClasses.map(c =>
          `<option value="${c.class_id}" ${car.class_id == c.class_id ? 'selected' : ''}>${c.class_name}</option>`
        ).join('');

        const classesJson = JSON.stringify(classes);

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Edit Vehicle - Admin Dashboard</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            <style>
              .current-image {
                width: 100%;
                max-width: 300px;
                border-radius: 12px;
                margin-bottom: 15px;
              }
              .current-image-placeholder {
                width: 100%;
                max-width: 300px;
                height: 150px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
                margin-bottom: 15px;
              }
              .file-input-wrapper {
                position: relative;
                overflow: hidden;
                display: inline-block;
                width: 100%;
              }
              .file-input-wrapper input[type=file] {
                position: absolute;
                left: 0;
                top: 0;
                opacity: 0;
                width: 100%;
                height: 100%;
                cursor: pointer;
              }
              .file-input-label {
                display: block;
                padding: 14px 16px;
                background: #f8f9fa;
                border: 2px dashed #e1e1e1;
                border-radius: 12px;
                text-align: center;
                color: #666;
                font-size: 14px;
                cursor: pointer;
              }
              .file-input-wrapper:hover .file-input-label {
                border-color: #e94560;
                background: #fff5f7;
              }
              .file-input-wrapper.has-file .file-input-label {
                border-color: #27ae60;
                background: rgba(39, 174, 96, 0.1);
                color: #27ae60;
              }
              .file-name {
                margin-top: 8px;
                font-size: 13px;
                color: #27ae60;
                text-align: center;
                font-weight: 600;
              }
              textarea {
                width: 100%;
                padding: 16px;
                border: 2px solid #e1e1e1;
                border-radius: 12px;
                font-size: 16px;
                font-family: inherit;
                resize: vertical;
                min-height: 100px;
                background: #f8f9fa;
              }
              textarea:focus {
                border-color: #e94560;
                outline: none;
                background: #fff;
              }
              .owner-info {
                background: #e8f4fd;
                padding: 12px 16px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-size: 14px;
                color: #2980b9;
              }
            </style>
          </head>
          <body>
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Admin Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/admin/app-config">App Config</a>
                <a href="/admin/vehicle-config">Vehicle Config</a>
                <a href="/admin/categories">Judge Config</a>
                <a href="/admin/specialty-votes">Special Vote Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Cars</a>
                <a href="/admin/judge-status">Judge Status</a>
                <a href="/admin/vote-status">Vote Status</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/profile">Profile</a>
              </div>

              <h3 class="section-title">Edit Vehicle: ${car.make} ${car.model}</h3>

              <div class="owner-info">
                <strong>Owner:</strong> ${car.owner_name || 'Unknown'} (@${car.owner_username || 'N/A'})
              </div>

              <form method="POST" action="/admin/edit-vehicle/${car.car_id}" enctype="multipart/form-data">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Make *</label>
                    <input type="text" name="make" required value="${car.make}">
                  </div>
                  <div class="form-group">
                    <label>Model *</label>
                    <input type="text" name="model" required value="${car.model}">
                  </div>
                  <div class="form-group">
                    <label>Vehicle Type *</label>
                    <select name="vehicle_id" id="vehicleType" required onchange="updateClasses()">
                      <option value="">Select vehicle type...</option>
                      ${vehicleOptionsHtml}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Class *</label>
                    <select name="class_id" id="classSelect" required>
                      <option value="">Select a class...</option>
                      ${classOptionsHtml}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Voter ID</label>
                    <input type="text" name="voter_id" value="${car.voter_id || ''}" placeholder="Assigned voter number">
                  </div>
                  <div class="form-group">
                    <label>Status</label>
                    <select name="is_active">
                      <option value="1" ${car.is_active ? 'selected' : ''}>Active</option>
                      <option value="0" ${!car.is_active ? 'selected' : ''}>Inactive</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" placeholder="Vehicle description...">${car.description || ''}</textarea>
                  </div>
                  <div class="form-group">
                    <label>Vehicle Photo</label>
                    ${car.image_url
                      ? `<img src="${car.image_url}" alt="${car.make} ${car.model}" class="current-image">`
                      : `<div class="current-image-placeholder">🚗</div>`
                    }
                    <div class="file-input-wrapper" id="fileWrapper">
                      <div class="file-input-label">
                        ${car.image_url ? 'Upload new image to replace current' : 'Click or tap to select an image'}<br>
                        <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                      </div>
                      <input type="file" name="vehicle_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                    </div>
                    <div class="file-name" id="fileName"></div>
                    <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin-top:10px;border-radius:8px;border:2px solid #e1e1e1;">
                  </div>
                  <button type="submit">Update Vehicle</button>
                </div>
              </form>

              <script>
                const allClasses = ${classesJson};

                function updateClasses() {
                  const vehicleId = document.getElementById('vehicleType').value;
                  const classSelect = document.getElementById('classSelect');
                  classSelect.innerHTML = '<option value="">Select a class...</option>';

                  if (vehicleId) {
                    const filteredClasses = allClasses.filter(c => c.vehicle_id == vehicleId);
                    filteredClasses.forEach(c => {
                      const option = document.createElement('option');
                      option.value = c.class_id;
                      option.textContent = c.class_name;
                      classSelect.appendChild(option);
                    });
                  }
                }

                function updateFileName(input) {
                  const fileName = document.getElementById('fileName');
                  const wrapper = document.getElementById('fileWrapper');
                  const preview = document.getElementById('imagePreview');
                  if (input.files && input.files[0]) {
                    fileName.textContent = 'Selected: ' + input.files[0].name;
                    wrapper.classList.add('has-file');
                    const reader = new FileReader();
                    reader.onload = function(e) {
                      preview.src = e.target.result;
                      preview.style.display = 'block';
                    };
                    reader.readAsDataURL(input.files[0]);
                  } else {
                    fileName.textContent = '';
                    wrapper.classList.remove('has-file');
                    preview.style.display = 'none';
                    preview.src = '';
                  }
                }
              </script>
            </div>
          </body>
          </html>
        `);
      });
    });
  });
});

// Handle admin vehicle update
app.post('/admin/edit-vehicle/:id', requireAdmin, upload.single('vehicle_photo'), async (req, res) => {
  const carId = req.params.id;
  const { make, model, vehicle_id, class_id, voter_id, is_active, description } = req.body;

  db.get('SELECT car_id, image_url FROM cars WHERE car_id = ?', [carId], async (err, car) => {
    if (err || !car) {
      res.redirect('/admin/vehicles');
      return;
    }

    let imageUrl = car.image_url;

    if (req.file) {
      try {
        const randomName = crypto.randomBytes(16).toString('hex');
        const filename = `${randomName}.jpg`;
        const filepath = path.join(__dirname, 'images', 'user_uploads', 'cars', filename);
        imageUrl = `/images/user_uploads/cars/${filename}`;

        await sharp(req.file.buffer)
          .rotate()
          .resize(800, 600, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 85 })
          .toFile(filepath);

        if (car.image_url) {
          const oldPath = path.join(__dirname, car.image_url);
          fs.unlink(oldPath, () => {});
        }
      } catch (error) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Update Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error processing image: ${error.message}</div>
              <div class="links">
                <a href="/admin/edit-vehicle/${carId}">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }
    }

    // Check if voter_id is unique (if provided)
    const performUpdate = () => {
      db.run('UPDATE cars SET make = ?, model = ?, vehicle_id = ?, class_id = ?, voter_id = ?, is_active = ?, description = ?, image_url = ? WHERE car_id = ?',
        [make, model, vehicle_id, class_id, voter_id || null, is_active, description || null, imageUrl, carId],
        function(err) {
          if (err) {
            res.send(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Update Error</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                ${styles}
              </head>
              <body>
                <div class="container">
                  <div class="logo">
                    <div class="logo-icon">🏎️</div>
                    <h1>Car Show Manager</h1>
                  </div>
                  <div class="error-message">Error updating vehicle: ${err.message}</div>
                  <div class="links">
                    <a href="/admin/edit-vehicle/${carId}">Try Again</a>
                  </div>
                </div>
              </body>
              </html>
            `);
          } else {
            res.redirect('/admin/vehicles');
          }
        });
    };

    if (voter_id && voter_id.trim() !== '') {
      db.get('SELECT car_id FROM cars WHERE voter_id = ? AND car_id != ?', [voter_id, carId], (checkErr, existingCar) => {
        if (existingCar) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Update Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Voter ID "${voter_id}" is already assigned to another vehicle. Each vehicle must have a unique Voter ID.</div>
                <div class="links">
                  <a href="/admin/edit-vehicle/${carId}">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
          return;
        }
        performUpdate();
      });
    } else {
      performUpdate();
    }
  });
});

// Admin delete vehicle
app.get('/admin/delete-vehicle/:id', requireAdmin, (req, res) => {
  const carId = req.params.id;

  db.get('SELECT car_id, image_url FROM cars WHERE car_id = ?', [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/admin/vehicles');
      return;
    }

    db.run('DELETE FROM cars WHERE car_id = ?', [carId], function(err) {
      if (!err && car.image_url) {
        const imagePath = path.join(__dirname, car.image_url);
        fs.unlink(imagePath, () => {});
      }
      res.redirect('/admin/vehicles');
    });
  });
});

// Judge page
app.get('/judge', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get count of active cars this judge has NOT yet scored
  db.get(`
    SELECT COUNT(DISTINCT c.car_id) as count
    FROM cars c
    WHERE c.is_active = 1
    AND c.car_id NOT IN (
      SELECT DISTINCT car_id FROM judge_scores WHERE judge_id = ?
    )
  `, [user.user_id], (err, carsToJudge) => {
    const carsToJudgeCount = carsToJudge ? carsToJudge.count : 0;

    // Get count of cars this judge has scored
    db.get(`
      SELECT COUNT(DISTINCT car_id) as count
      FROM judge_scores
      WHERE judge_id = ?
    `, [user.user_id], (err, scoresSubmitted) => {
      const scoresSubmittedCount = scoresSubmitted ? scoresSubmitted.count : 0;

      // Get total active cars
      db.get(`SELECT COUNT(*) as count FROM cars WHERE is_active = 1`, (err, totalCars) => {
        const totalCarsCount = totalCars ? totalCars.count : 0;

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Judge Dashboard - Car Show Manager</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
          </head>
          <body>
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Car Judge</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="welcome-card">
                <h2>Welcome, Judge ${user.name}!</h2>
                <p>Review and score car show entries.</p>
              </div>

              <div class="admin-nav">
                <a href="/judge" class="active">Dashboard</a>
                <a href="/judge/judge-vehicles">Judge Vehicles</a>
                <a href="/judge/vehicles">Vehicles</a>
                <a href="/judge/users">View Users</a>
                <a href="/judge/results">Results</a>
                <a href="/judge/profile">My Profile</a>
              </div>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-number">${carsToJudgeCount}</div>
                  <div class="stat-label">Cars to Judge</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${scoresSubmittedCount}</div>
                  <div class="stat-label">Cars Scored</div>
                </div>
                <div class="stat-card">
                  <div class="stat-number">${totalCarsCount}</div>
                  <div class="stat-label">Total Active Cars</div>
                </div>
              </div>

              ${appConfig.judgeVotingLocked ? `
                <div style="margin-top:20px;padding:15px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;text-align:center;">
                  <strong>🔒 Voting is Locked</strong> - Results have been published. <a href="/judge/results">View Results</a>
                </div>
              ` : carsToJudgeCount > 0 ? `
                <div style="margin-top:20px;text-align:center;">
                  <a href="/judge/judge-vehicles" style="display:inline-block;padding:15px 30px;background:linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">Start Judging Vehicles</a>
                </div>
              ` : ''}
            </div>
          </body>
          </html>
        `);
      });
    });
  });
});

// Judge view users page
app.get('/judge/users', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all non-admin users
  db.all('SELECT user_id as id, username, name, email, phone, role, is_active, created_at FROM users WHERE role != ? ORDER BY role, name', ['admin'], (err, users) => {
    if (err) {
      users = [];
    }

    const userRows = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || '-'}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <a href="/judge/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </td>
      </tr>
    `).join('');

    // Mobile card view
    const userCards = users.map(u => `
      <div class="user-card">
        <div class="user-card-header">
          <div>
            <div class="user-card-name">${u.name}</div>
            <div class="user-card-username">@${u.username}</div>
          </div>
        </div>
        <div class="user-card-details">
          <div>${u.email}</div>
          ${u.phone ? `<div>${u.phone}</div>` : ''}
        </div>
        <div class="user-card-badges">
          <span class="role-badge ${u.role}">${u.role}</span>
          <span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="user-card-actions">
          <a href="/judge/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>View Users - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/judge-vehicles">Judge Vehicles</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users" class="active">View Users</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <h3 class="section-title">Users & Judges</h3>
          <p style="color: #666; margin-bottom: 15px; font-size: 14px;">You can reset passwords for users and other judges. Admin accounts are not shown.</p>

          <!-- Mobile card view -->
          <div class="user-cards">
            ${userCards}
          </div>

          <!-- Table view for larger screens -->
          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${userRows}
              </tbody>
            </table>
          </div>
          <div class="scroll-hint"></div>
        </div>
      </body>
      </html>
    `);
  });
});

// Judge reset password page
app.get('/judge/reset-password/:id', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;
  const userId = req.params.id;

  // Get the user but only if they're not an admin
  db.get('SELECT user_id as id, username, name, role FROM users WHERE user_id = ? AND role != ?', [userId, 'admin'], (err, targetUser) => {
    if (err || !targetUser) {
      res.redirect('/judge/users');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reset Password - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/judge-vehicles">Judge Vehicles</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/results">Results</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <h3 class="section-title">Reset Password for: ${targetUser.name}</h3>
          <div class="profile-card">
            <p style="margin-bottom: 15px;"><strong>Username:</strong> ${targetUser.username}</p>
            <p style="margin-bottom: 20px;"><strong>Role:</strong> <span class="role-badge ${targetUser.role}">${targetUser.role}</span></p>

            <form method="POST" action="/judge/reset-password/${targetUser.id}">
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Reset Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle judge password reset
app.post('/judge/reset-password/:id', requireJudge, (req, res) => {
  const userId = req.params.id;
  const { password, confirm_password } = req.body;

  // First verify the target user is not an admin
  db.get('SELECT user_id as id, name, role FROM users WHERE user_id = ? AND role != ?', [userId, 'admin'], (err, targetUser) => {
    if (err || !targetUser) {
      res.redirect('/judge/users');
      return;
    }

    if (password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reset Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Passwords do not match!</div>
            <div class="links">
              <a href="/judge/reset-password/${userId}">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ? AND role != ?', [hashedPassword, userId, 'admin'], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Reset Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error resetting password: ${err.message}</div>
              <div class="links">
                <a href="/judge/users">Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Reset</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password reset successfully for ${targetUser.name}!</div>
              <div class="links">
                <a href="/judge/users">Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Judge Vehicles page - shows vehicles ready to be judged
app.get('/judge/judge-vehicles', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Check if voting is locked
  if (appConfig.judgeVotingLocked) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Judge Vehicles - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/judge-vehicles" class="active">Judge Vehicles</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/results">Results</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <div style="text-align:center;padding:40px;background:#f8f9fa;border-radius:8px;">
            <div style="font-size:48px;margin-bottom:20px;">🔒</div>
            <h3 style="color:#666;margin-bottom:10px;">Voting is Locked</h3>
            <p style="color:#999;">Judging has been finalized by the administrator. <a href="/judge/results">View Results</a></p>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Get all active cars that this judge has NOT yet scored
  db.all(`
    SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.vehicle_id, c.class_id,
           u.name as owner_name, cl.class_name, v.vehicle_name
    FROM cars c
    LEFT JOIN users u ON c.user_id = u.user_id
    LEFT JOIN classes cl ON c.class_id = cl.class_id
    LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
    WHERE c.is_active = 1
    AND c.car_id NOT IN (SELECT DISTINCT car_id FROM judge_scores WHERE judge_id = ?)
    ORDER BY cl.class_name, c.make, c.model
  `, [user.user_id], (err, carsToJudge) => {
    if (err) carsToJudge = [];

    // Get cars this judge has already scored
    db.all(`
      SELECT c.car_id, c.year, c.make, c.model, c.voter_id, cl.class_name,
             SUM(js.score) as total_score
      FROM cars c
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      JOIN judge_scores js ON c.car_id = js.car_id AND js.judge_id = ?
      WHERE c.is_active = 1
      GROUP BY c.car_id
      ORDER BY cl.class_name, c.make, c.model
    `, [user.user_id], (err, carsJudged) => {
      if (err) carsJudged = [];

      const toJudgeCards = carsToJudge.map(car => `
        <div class="vehicle-card">
          <div class="vehicle-image">
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </div>
          <div class="vehicle-info">
            <div class="vehicle-title">${car.year || ''} ${car.make} ${car.model}</div>
            <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'}</div>
            <div class="vehicle-class">
              ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
              ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
              ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
            </div>
          </div>
          <div class="vehicle-actions">
            <a href="/judge/score-vehicle/${car.car_id}" class="action-btn" style="background:linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);">Score Vehicle</a>
          </div>
        </div>
      `).join('');

      const judgedCards = carsJudged.map(car => `
        <div class="vehicle-card" style="border-color:#27ae60;">
          <div class="vehicle-info" style="flex:1;">
            <div class="vehicle-title">${car.year || ''} ${car.make} ${car.model}</div>
            <div class="vehicle-class">
              ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
              ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="background:#27ae60;color:white;padding:6px 14px;border-radius:20px;font-weight:600;">${car.total_score} pts</span>
            <span style="color:#27ae60;font-weight:600;">✓ Scored</span>
          </div>
        </div>
      `).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Judge Vehicles - Car Show Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          <style>
            .vehicle-card {
              background: #f8f9fa;
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 12px;
              border: 1px solid #e1e1e1;
              display: flex;
              flex-direction: column;
              gap: 12px;
            }
            .vehicle-image {
              width: 100%;
              height: 120px;
              border-radius: 8px;
              overflow: hidden;
              background: #e1e1e1;
            }
            .vehicle-image img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .vehicle-placeholder {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 36px;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            }
            .vehicle-info { flex: 1; }
            .vehicle-title {
              font-size: 16px;
              font-weight: 700;
              color: #1a1a2e;
              margin-bottom: 4px;
            }
            .vehicle-meta {
              font-size: 12px;
              color: #888;
              margin-bottom: 8px;
            }
            .vehicle-class {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
            }
            .type-badge {
              background: #3498db;
              color: white;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
            }
            .class-badge {
              background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
              color: white;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
            }
            .voter-badge {
              background: #9b59b6;
              color: white;
              padding: 3px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
            }
            .vehicle-actions {
              display: flex;
              gap: 8px;
            }
            @media (min-width: 768px) {
              .vehicle-card {
                flex-direction: row;
                align-items: center;
              }
              .vehicle-image {
                width: 150px;
                height: 100px;
                flex-shrink: 0;
              }
              .vehicle-actions {
                flex-shrink: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Judge</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles" class="active">Judge Vehicles</a>
              <a href="/judge/vehicles">Vehicles</a>
              <a href="/judge/users">View Users</a>
              <a href="/judge/results">Results</a>
              <a href="/judge/profile">My Profile</a>
            </div>

            <h3 class="section-title">Vehicles Ready to Judge (${carsToJudge.length})</h3>

            ${carsToJudge.length > 0 ? toJudgeCards : '<p style="color: #27ae60; text-align: center; padding: 20px; background: #d4edda; border-radius: 8px;">🎉 You have scored all active vehicles!</p>'}

            ${carsJudged.length > 0 ? `
              <h3 class="section-title" style="margin-top:30px;">Already Scored (${carsJudged.length})</h3>
              ${judgedCards}
            ` : ''}
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Score vehicle page - the scoring sheet
app.get('/judge/score-vehicle/:carId', requireJudge, (req, res) => {
  const user = req.session.user;
  const carId = req.params.carId;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Check if voting is locked
  if (appConfig.judgeVotingLocked) {
    res.redirect('/judge/judge-vehicles');
    return;
  }

  // Get car details
  db.get(`
    SELECT c.*, u.name as owner_name, cl.class_name, v.vehicle_id, v.vehicle_name
    FROM cars c
    LEFT JOIN users u ON c.user_id = u.user_id
    LEFT JOIN classes cl ON c.class_id = cl.class_id
    LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
    WHERE c.car_id = ? AND c.is_active = 1
  `, [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/judge/judge-vehicles');
      return;
    }

    // Check if judge has already scored this vehicle
    db.get(`SELECT COUNT(*) as count FROM judge_scores WHERE judge_id = ? AND car_id = ?`, [user.user_id, carId], (err, scored) => {
      if (scored && scored.count > 0) {
        res.redirect('/judge/judge-vehicles');
        return;
      }

      // Get judging categories and questions for this vehicle type
      db.all(`
        SELECT jc.judge_catagory_id, jc.catagory_name, jc.display_order as cat_order
        FROM judge_catagories jc
        WHERE jc.vehicle_id = ? AND jc.is_active = 1
        ORDER BY jc.display_order, jc.catagory_name
      `, [car.vehicle_id], (err, categories) => {
        if (err) categories = [];

        db.all(`
          SELECT jq.judge_question_id, jq.judge_catagory_id, jq.question, jq.min_score, jq.max_score, jq.display_order
          FROM judge_questions jq
          WHERE jq.vehicle_id = ? AND jq.is_active = 1
          ORDER BY jq.display_order, jq.question
        `, [car.vehicle_id], (err, questions) => {
          if (err) questions = [];

          // Group questions by category
          const questionsByCategory = {};
          questions.forEach(q => {
            if (!questionsByCategory[q.judge_catagory_id]) {
              questionsByCategory[q.judge_catagory_id] = [];
            }
            questionsByCategory[q.judge_catagory_id].push(q);
          });

          // Build the scoring form with bubble selectors
          const categoryForms = categories.map(cat => {
            const catQuestions = questionsByCategory[cat.judge_catagory_id] || [];
            const questionInputs = catQuestions.map(q => {
              let bubbles = '';
              for (let i = q.min_score; i <= q.max_score; i++) {
                bubbles += `<div class="score-bubble" data-value="${i}" onclick="selectScore(this, 'score_${q.judge_question_id}')">${i}</div>`;
              }
              return `
                <div class="score-question">
                  <div class="question-text">${q.question} <span class="score-range">(${q.min_score}-${q.max_score})</span></div>
                  <div class="bubble-row">
                    ${bubbles}
                  </div>
                  <input type="hidden" name="score_${q.judge_question_id}" id="score_${q.judge_question_id}" required>
                </div>
              `;
            }).join('');

            return `
              <div class="category-section">
                <h4 class="category-title">${cat.catagory_name}</h4>
                ${questionInputs || '<p style="color:#999;">No questions in this category</p>'}
              </div>
            `;
          }).join('');

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Score Vehicle - Car Show Manager</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${adminStyles}
              <style>
                .car-header {
                  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                  color: white;
                  padding: 20px;
                  border-radius: 12px;
                  margin-bottom: 20px;
                  display: flex;
                  gap: 20px;
                  align-items: center;
                }
                .car-header-image {
                  width: 120px;
                  height: 80px;
                  border-radius: 8px;
                  overflow: hidden;
                  flex-shrink: 0;
                }
                .car-header-image img {
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                }
                .car-header-info h2 {
                  margin: 0 0 8px 0;
                  font-size: 20px;
                }
                .car-header-info p {
                  margin: 0;
                  opacity: 0.8;
                  font-size: 14px;
                }
                .category-section {
                  background: #f8f9fa;
                  border-radius: 12px;
                  padding: 20px;
                  margin-bottom: 15px;
                  border: 1px solid #e1e1e1;
                }
                .category-title {
                  margin: 0 0 15px 0;
                  padding-bottom: 10px;
                  border-bottom: 2px solid #3498db;
                  color: #2c3e50;
                }
                .score-question {
                  padding: 12px 0;
                  border-bottom: 1px solid #e1e1e1;
                }
                .score-question:last-child {
                  border-bottom: none;
                }
                .question-text {
                  font-size: 14px;
                  color: #333;
                  margin-bottom: 8px;
                }
                .score-range {
                  font-size: 12px;
                  color: #888;
                  font-weight: 400;
                }
                .bubble-row {
                  display: flex;
                  flex-wrap: wrap;
                  gap: 6px;
                }
                .score-bubble {
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  border: 2px solid #ddd;
                  background: #fff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 14px;
                  font-weight: 600;
                  color: #333;
                  cursor: pointer;
                  transition: all 0.15s;
                  user-select: none;
                  -webkit-tap-highlight-color: transparent;
                }
                .score-bubble:active {
                  transform: scale(0.95);
                }
                .score-bubble.selected {
                  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                  color: white;
                  border-color: #2980b9;
                  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.4);
                }
                .submit-section {
                  background: #fff3cd;
                  border: 2px solid #ffc107;
                  border-radius: 12px;
                  padding: 20px;
                  margin-top: 20px;
                  text-align: center;
                }
                .submit-warning {
                  color: #856404;
                  margin-bottom: 15px;
                  font-size: 14px;
                }
                .submit-btn {
                  background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                  color: white;
                  border: none;
                  padding: 15px 40px;
                  border-radius: 8px;
                  font-size: 18px;
                  font-weight: 600;
                  cursor: pointer;
                }
                .submit-btn:hover {
                  opacity: 0.9;
                }
                @media (max-width: 600px) {
                  .score-bubble {
                    width: 36px;
                    height: 36px;
                    font-size: 13px;
                  }
                }
              </style>
            </head>
            <body>
              <div class="container dashboard-container">
                <div class="dashboard-header">
                  <h1>🏎️ Car Judge</h1>
                  <div class="user-info">
                    <div class="user-avatar">${avatarContent}</div>
                    <a href="/logout" class="logout-btn">Sign Out</a>
                  </div>
                </div>

                <div class="admin-nav">
                  <a href="/judge">Dashboard</a>
                  <a href="/judge/judge-vehicles" class="active">Judge Vehicles</a>
                  <a href="/judge/vehicles">Vehicles</a>
                  <a href="/judge/users">View Users</a>
                  <a href="/judge/results">Results</a>
                  <a href="/judge/profile">My Profile</a>
                </div>

                <div class="car-header">
                  ${car.image_url ? `
                    <div class="car-header-image">
                      <img src="${car.image_url}" alt="${car.make} ${car.model}">
                    </div>
                  ` : ''}
                  <div class="car-header-info">
                    <h2>${car.year || ''} ${car.make} ${car.model}</h2>
                    <p>Owner: ${car.owner_name || 'Unknown'} | Voter ID: #${car.voter_id || 'N/A'}</p>
                    <p>Class: ${car.class_name || 'Unassigned'} | Type: ${car.vehicle_name || 'Unknown'}</p>
                  </div>
                </div>

                <form method="POST" action="/judge/submit-scores/${carId}" onsubmit="return confirmSubmit()">
                  <h3 class="section-title">Scoring Sheet</h3>

                  ${categoryForms || '<p style="color:#e74c3c;padding:20px;background:#f8f9fa;border-radius:8px;">No judging categories configured for this vehicle type. Please contact the administrator.</p>'}

                  ${categories.length > 0 ? `
                    <div class="submit-section">
                      <p class="submit-warning">⚠️ <strong>Warning:</strong> Once you submit your scores, you cannot change them. Please review all scores carefully before submitting.</p>
                      <button type="submit" class="submit-btn">Submit Scores</button>
                    </div>
                  ` : ''}
                </form>

                <div style="margin-top:20px;">
                  <a href="/judge/judge-vehicles" style="color:#666;">← Back to Vehicles List</a>
                </div>
              </div>

              <script>
                function selectScore(bubble, inputName) {
                  // Deselect siblings
                  bubble.parentNode.querySelectorAll('.score-bubble').forEach(b => b.classList.remove('selected'));
                  // Select this one
                  bubble.classList.add('selected');
                  // Set hidden input value
                  document.getElementById(inputName).value = bubble.dataset.value;
                }

                function confirmSubmit() {
                  // Check all hidden score inputs have values
                  const hiddenInputs = document.querySelectorAll('input[type="hidden"][name^="score_"]');
                  for (const input of hiddenInputs) {
                    if (!input.value) {
                      alert('Please select a score for every question before submitting.');
                      return false;
                    }
                  }
                  return confirm('Are you sure you want to submit these scores?\\n\\nOnce submitted, you CANNOT change your scores for this vehicle.');
                }
              </script>
            </body>
            </html>
          `);
        });
      });
    });
  });
});

// Submit judge scores
app.post('/judge/submit-scores/:carId', requireJudge, (req, res) => {
  const user = req.session.user;
  const carId = req.params.carId;

  // Check if voting is locked
  if (appConfig.judgeVotingLocked) {
    res.redirect('/judge/judge-vehicles');
    return;
  }

  // Check if already scored
  db.get(`SELECT COUNT(*) as count FROM judge_scores WHERE judge_id = ? AND car_id = ?`, [user.user_id, carId], (err, scored) => {
    if (scored && scored.count > 0) {
      res.redirect('/judge/judge-vehicles');
      return;
    }

    // Extract scores from form
    const scores = [];
    for (const key in req.body) {
      if (key.startsWith('score_')) {
        const questionId = key.replace('score_', '');
        const score = parseInt(req.body[key]);
        if (!isNaN(score)) {
          scores.push({ questionId, score });
        }
      }
    }

    if (scores.length === 0) {
      res.redirect(`/judge/score-vehicle/${carId}`);
      return;
    }

    // Insert all scores
    const placeholders = scores.map(() => '(?, ?, ?, ?)').join(', ');
    const values = [];
    scores.forEach(s => {
      values.push(user.user_id, carId, s.questionId, s.score);
    });

    db.run(`INSERT INTO judge_scores (judge_id, car_id, question_id, score) VALUES ${placeholders}`, values, (err) => {
      if (err) {
        console.error('Error saving scores:', err);
      }
      res.redirect('/judge/judge-vehicles');
    });
  });
});

// Judge Results page - shows published results after voting is locked
app.get('/judge/results', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Check if results are published
  const judgeResultsPublished = appConfig.judgeVotingLocked;
  const specialtyResultsPublished = appConfig.specialtyVotingLocked;

  if (!judgeResultsPublished && !specialtyResultsPublished) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Results - Judge</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Judge Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/judge-vehicles">Judge Vehicles</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/results" class="active">Results</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <h3 class="section-title">Results</h3>
          <div style="text-align:center;padding:40px;background:#f8f9fa;border-radius:8px;">
            <div style="font-size:48px;margin-bottom:20px;">🔒</div>
            <h3 style="color:#666;margin-bottom:10px;">Results Not Yet Published</h3>
            <p style="color:#999;">Results will be available here once voting has been locked by the administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Get published judge results
  db.all(`
    SELECT pr.*, c.year, c.make, c.model, c.voter_id, cl.class_name
    FROM published_results pr
    JOIN cars c ON pr.car_id = c.car_id
    LEFT JOIN classes cl ON pr.class_id = cl.class_id
    WHERE pr.result_type = 'judge'
    ORDER BY pr.class_id, pr.place
  `, (err, judgeResults) => {
    if (err) judgeResults = [];

    // Get published specialty vote results
    db.all(`
      SELECT pr.*, c.year, c.make, c.model, c.voter_id, sv.vote_name
      FROM published_results pr
      JOIN cars c ON pr.car_id = c.car_id
      LEFT JOIN specialty_votes sv ON pr.specialty_vote_id = sv.specialty_vote_id
      WHERE pr.result_type = 'specialty'
      ORDER BY sv.vote_name
    `, (err, specialtyResults) => {
      if (err) specialtyResults = [];

      // Group judge results by class
      const judgeResultsByClass = {};
      judgeResults.forEach(r => {
        if (!judgeResultsByClass[r.class_name]) {
          judgeResultsByClass[r.class_name] = [];
        }
        judgeResultsByClass[r.class_name].push(r);
      });

      const placeLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];

      // Build judge results HTML
      let judgeResultsHtml = '';
      if (judgeResultsPublished && Object.keys(judgeResultsByClass).length > 0) {
        judgeResultsHtml = `
          <h3 class="section-title">Judge Results - Winners by Class</h3>
          ${Object.keys(judgeResultsByClass).map(className => {
            const classResults = judgeResultsByClass[className];
            const resultsList = classResults.map(r => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:${r.place === 1 ? '#fff9e6' : '#f8f9fa'};border-radius:6px;margin-bottom:8px;border:${r.place === 1 ? '2px solid #f1c40f' : '1px solid #ddd'};">
                <span><strong>${placeLabels[r.place - 1] || r.place}</strong> - ${r.year || ''} ${r.make} ${r.model} (ID: ${r.voter_id || 'N/A'})</span>
                <span style="background:#27ae60;color:white;padding:4px 12px;border-radius:20px;font-weight:600;">${r.total_score || 0} pts</span>
              </div>
            `).join('');
            return `
              <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:20px;">
                <h4 style="margin:0 0 15px 0;color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:10px;">${className}</h4>
                ${resultsList}
              </div>
            `;
          }).join('')}
        `;
      } else if (judgeResultsPublished) {
        judgeResultsHtml = `
          <h3 class="section-title">Judge Results</h3>
          <p style="color:#999;">No judge results have been published yet.</p>
        `;
      }

      // Build specialty results HTML
      let specialtyResultsHtml = '';
      if (specialtyResultsPublished && specialtyResults.length > 0) {
        specialtyResultsHtml = `
          <h3 class="section-title" style="margin-top:30px;">Specialty Vote Winners</h3>
          ${specialtyResults.map(r => `
            <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:20px;">
              <h4 style="margin:0 0 15px 0;color:#2c3e50;border-bottom:2px solid #9b59b6;padding-bottom:10px;">${r.vote_name}</h4>
              <div style="background:#fff9e6;border:2px solid #f1c40f;border-radius:8px;padding:15px;text-align:center;">
                <div style="font-size:36px;margin-bottom:10px;">🏆</div>
                <div style="font-size:18px;font-weight:bold;color:#2c3e50;">${r.year || ''} ${r.make} ${r.model}</div>
                <div style="color:#666;margin-top:5px;">Voter ID: ${r.voter_id || 'N/A'}</div>
                <div style="margin-top:10px;background:#27ae60;color:white;padding:6px 16px;border-radius:20px;display:inline-block;font-weight:600;">${r.total_score || 0} votes</div>
              </div>
            </div>
          `).join('')}
        `;
      } else if (specialtyResultsPublished) {
        specialtyResultsHtml = `
          <h3 class="section-title" style="margin-top:30px;">Specialty Vote Results</h3>
          <p style="color:#999;">No specialty vote results have been published yet.</p>
        `;
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Results - Judge</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Judge Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles">Judge Vehicles</a>
              <a href="/judge/vehicles">Vehicles</a>
              <a href="/judge/users">View Users</a>
              <a href="/judge/results" class="active">Results</a>
              <a href="/judge/profile">My Profile</a>
            </div>

            ${judgeResultsHtml}
            ${specialtyResultsHtml}
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Judge profile page
app.get('/judge/profile', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get fresh user data from database
  db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
    if (err || !currentUser) {
      res.redirect('/judge');
      return;
    }

    const profileImageHtml = currentUser.image_url
      ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
      : `<div class="profile-image-placeholder">${initials}</div>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Profile - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .profile-image-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }
          .profile-image, .profile-image-placeholder {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 15px;
            border: 4px solid #e94560;
          }
          .profile-image-placeholder {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 42px;
            font-weight: 700;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${currentUser.image_url ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/judge-vehicles">Judge Vehicles</a>
            <a href="/judge/vehicles">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/profile" class="active">My Profile</a>
          </div>

          <div class="profile-card">
            <h3>Profile Picture</h3>
            <div class="profile-image-container">
              ${profileImageHtml}
            </div>
            <form method="POST" action="/judge/upload-photo" enctype="multipart/form-data">
              <div class="form-group">
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    Click or tap to select an image<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
                <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin-top:10px;border-radius:8px;border:2px solid #e1e1e1;">
              </div>
              <button type="submit">Upload Photo</button>
            </form>
            <script>
              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                const preview = document.getElementById('imagePreview');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                  const reader = new FileReader();
                  reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                  };
                  reader.readAsDataURL(input.files[0]);
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                  preview.style.display = 'none';
                  preview.src = '';
                }
              }
            </script>
          </div>

          <div class="profile-card">
            <h3>Update Email</h3>
            <form method="POST" action="/judge/update-email">
              <div class="form-group">
                <label>Current Email</label>
                <input type="email" value="${currentUser.email}" disabled>
              </div>
              <div class="form-group">
                <label>New Email Address</label>
                <input type="email" name="email" required placeholder="Enter new email">
              </div>
              <button type="submit">Update Email</button>
            </form>
          </div>

          <div class="profile-card">
            <h3>Change Password</h3>
            <form method="POST" action="/judge/change-password">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="current_password" required placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="new_password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle judge profile photo upload
app.post('/judge/upload-photo', requireJudge, upload.single('profile_photo'), async (req, res) => {
  const user = req.session.user;

  if (!req.file) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Please select an image file to upload.</div>
          <div class="links">
            <a href="/judge/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(__dirname, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    db.get('SELECT image_url FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        const oldPath = path.join(__dirname, row.image_url);
        fs.unlink(oldPath, () => {});
      }

      db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, user.user_id], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Upload Photo - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error saving photo: ${err.message}</div>
                <div class="links">
                  <a href="/judge/profile">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          req.session.user.image_url = imageUrl;
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Photo Uploaded</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Profile photo uploaded successfully!</div>
                <div class="links">
                  <a href="/judge/profile">Back to Profile</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Error processing image: ${error.message}</div>
          <div class="links">
            <a href="/judge/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Handle judge email update
app.post('/judge/update-email', requireJudge, (req, res) => {
  const user = req.session.user;
  const { email } = req.body;

  db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Email - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating email: ${err.message}</div>
            <div class="links">
              <a href="/judge/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      req.session.user.email = email;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Updated</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="success-message">Email updated successfully!</div>
            <div class="links">
              <a href="/judge/profile">Back to Profile</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Handle judge password change
app.post('/judge/change-password', requireJudge, (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
    if (err || !row) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error retrieving user data.</div>
            <div class="links">
              <a href="/judge/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (!verifyPassword(current_password, row.password_hash)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Current password is incorrect.</div>
            <div class="links">
              <a href="/judge/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (new_password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">New passwords do not match.</div>
            <div class="links">
              <a href="/judge/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.user_id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating password: ${err.message}</div>
              <div class="links">
                <a href="/judge/profile">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Changed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password changed successfully!</div>
              <div class="links">
                <a href="/judge/profile">Back to Profile</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Judge vehicles page - view and change class
app.get('/judge/vehicles', requireJudge, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all active vehicles with owner info and class names
  db.all(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.vehicle_id, c.class_id,
          u.name as owner_name, cl.class_name, v.vehicle_name
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          LEFT JOIN classes cl ON c.class_id = cl.class_id
          LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
          WHERE c.is_active = 1
          ORDER BY cl.class_name, c.make, c.model`, (err, activeCars) => {
    if (err) activeCars = [];

    // Get all inactive vehicles
    db.all(`SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id, c.vehicle_id, c.class_id,
            u.name as owner_name, cl.class_name, v.vehicle_name
            FROM cars c
            LEFT JOIN users u ON c.user_id = u.user_id
            LEFT JOIN classes cl ON c.class_id = cl.class_id
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            WHERE c.is_active = 0
            ORDER BY c.make, c.model`, (err, inactiveCars) => {
      if (err) inactiveCars = [];

      const vehicleCards = activeCars.map(car => `
        <div class="vehicle-card">
          <div class="vehicle-image">
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </div>
          <div class="vehicle-info">
            <div class="vehicle-title">${car.year || ''} ${car.make} ${car.model}</div>
            <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'}</div>
            <div class="vehicle-class">
              ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
              ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
              ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
            </div>
            ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
          </div>
          <div class="vehicle-actions">
            <a href="/judge/edit-vehicle/${car.car_id}" class="action-btn edit">Change Class</a>
          </div>
        </div>
      `).join('');

      const inactiveVehicleCards = inactiveCars.map(car => `
        <div class="vehicle-card" style="opacity: 0.7; border-color: #ffc107;">
          <div class="vehicle-image">
            ${car.image_url
              ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
              : `<div class="vehicle-placeholder">🚗</div>`
            }
          </div>
          <div class="vehicle-info">
            <div class="vehicle-title">${car.year || ''} ${car.make} ${car.model}</div>
            <div class="vehicle-meta">Owner: ${car.owner_name || 'Unknown'}</div>
            <div class="vehicle-class">
              ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
              ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
              ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
            </div>
            ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
          </div>
          <div class="vehicle-actions">
            <span style="color:#856404;font-size:12px;font-weight:600;">⏳ Awaiting Activation</span>
          </div>
        </div>
      `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vehicles - Judge Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #e1e1e1;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .vehicle-image {
            width: 100%;
            height: 120px;
            border-radius: 8px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }
          .vehicle-info {
            flex: 1;
          }
          .vehicle-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 4px;
          }
          .vehicle-meta {
            font-size: 12px;
            color: #888;
            margin-bottom: 8px;
          }
          .vehicle-class {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 8px;
          }
          .type-badge {
            background: #3498db;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .class-badge {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .voter-badge {
            background: #9b59b6;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .vehicle-description {
            font-size: 13px;
            color: #666;
            line-height: 1.4;
          }
          .vehicle-actions {
            display: flex;
            gap: 8px;
          }
          @media (min-width: 768px) {
            .vehicle-card {
              flex-direction: row;
              align-items: center;
            }
            .vehicle-image {
              width: 150px;
              height: 100px;
              flex-shrink: 0;
            }
            .vehicle-actions {
              flex-shrink: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Judge</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/judge">Dashboard</a>
            <a href="/judge/judge-vehicles">Judge Vehicles</a>
            <a href="/judge/vehicles" class="active">Vehicles</a>
            <a href="/judge/users">View Users</a>
            <a href="/judge/results">Results</a>
            <a href="/judge/profile">My Profile</a>
          </div>

          <h3 class="section-title">Active Vehicles (${activeCars.length})</h3>

          ${activeCars.length > 0 ? vehicleCards : '<p style="color: #666; text-align: center; padding: 20px;">No active vehicles to judge.</p>'}

          <h3 class="section-title" style="margin-top:30px;">Inactive Vehicles - Awaiting Registration (${inactiveCars.length})</h3>
          <p style="color:#856404;font-size:13px;margin-bottom:15px;">These vehicles are waiting to be activated by the registrar. You cannot judge them until they are activated.</p>

          ${inactiveCars.length > 0 ? inactiveVehicleCards : '<p style="color: #666; text-align: center; padding: 20px;">No inactive vehicles.</p>'}
        </div>
      </body>
      </html>
    `);
    });
  });
});

// Judge edit vehicle class page
app.get('/judge/edit-vehicle/:id', requireJudge, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT c.*, u.name as owner_name, cl.class_name, v.vehicle_name
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          LEFT JOIN classes cl ON c.class_id = cl.class_id
          LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
          WHERE c.car_id = ? AND c.is_active = 1`, [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/judge/vehicles');
      return;
    }

    // Get classes for the current vehicle type (judges can only change class within same vehicle type)
    db.all(`SELECT class_id, class_name FROM classes WHERE vehicle_id = ? AND is_active = 1 ORDER BY class_name`,
      [car.vehicle_id], (err, classes) => {
      if (err) classes = [];

      const classOptionsHtml = classes.map(c =>
        `<option value="${c.class_id}" ${car.class_id == c.class_id ? 'selected' : ''}>${c.class_name}</option>`
      ).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Vehicle Class - Judge Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          <style>
            .vehicle-preview {
              display: flex;
              flex-direction: column;
              gap: 16px;
              margin-bottom: 20px;
            }
            .vehicle-preview-image {
              width: 100%;
              max-width: 300px;
              height: 200px;
              border-radius: 12px;
              overflow: hidden;
              background: #e1e1e1;
            }
            .vehicle-preview-image img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .vehicle-preview-placeholder {
              width: 100%;
              max-width: 300px;
              height: 200px;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 64px;
            }
            .vehicle-preview-info h4 {
              font-size: 20px;
              margin-bottom: 8px;
              color: #1a1a2e;
            }
            .vehicle-preview-info p {
              color: #666;
              margin-bottom: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Judge</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/judge">Dashboard</a>
              <a href="/judge/judge-vehicles">Judge Vehicles</a>
              <a href="/judge/vehicles">Vehicles</a>
              <a href="/judge/users">View Users</a>
              <a href="/judge/results">Results</a>
              <a href="/judge/profile">My Profile</a>
            </div>

            <h3 class="section-title">Change Vehicle Class</h3>

            <div class="vehicle-preview">
              ${car.image_url
                ? `<div class="vehicle-preview-image"><img src="${car.image_url}" alt="${car.make} ${car.model}"></div>`
                : `<div class="vehicle-preview-placeholder">🚗</div>`
              }
              <div class="vehicle-preview-info">
                <h4>${car.make} ${car.model}</h4>
                <p><strong>Owner:</strong> ${car.owner_name || 'Unknown'}</p>
                <p><strong>Vehicle Type:</strong> ${car.vehicle_name || 'N/A'}</p>
                ${car.description ? `<p>${car.description}</p>` : ''}
              </div>
            </div>

            <form method="POST" action="/judge/edit-vehicle/${car.car_id}">
              <div class="profile-card">
                <div class="form-group">
                  <label>Current Class</label>
                  <input type="text" value="${car.class_name || 'N/A'}" disabled>
                </div>
                <div class="form-group">
                  <label>New Class</label>
                  <select name="class_id" required>
                    ${classOptionsHtml}
                  </select>
                </div>
                <button type="submit">Update Class</button>
              </div>
            </form>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Handle judge vehicle class update
app.post('/judge/edit-vehicle/:id', requireJudge, (req, res) => {
  const carId = req.params.id;
  const { class_id } = req.body;

  db.run('UPDATE cars SET class_id = ? WHERE car_id = ? AND is_active = 1', [class_id, carId], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating vehicle class: ${err.message}</div>
            <div class="links">
              <a href="/judge/vehicles">Back to Vehicles</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      res.redirect('/judge/vehicles');
    }
  });
});

// Registrar dashboard page
app.get('/registrar', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get count of users for stats
  db.all('SELECT user_id as id, username, name, email, phone, role, is_active FROM users WHERE role = ? ORDER BY name', ['user'], (err, users) => {
    if (err) {
      users = [];
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Registrar Dashboard - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="welcome-card">
            <h2>Welcome, ${user.name}!</h2>
            <p>Handle participant check-in and registration tasks.</p>
          </div>

          <div class="admin-nav">
            <a href="/registrar" class="active">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${users.length}</div>
              <div class="stat-label">Registered Users</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">0</div>
              <div class="stat-label">Checked In</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Registrar view users page
app.get('/registrar/users', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all users (not admins)
  db.all('SELECT user_id as id, username, name, email, phone, role, is_active FROM users WHERE role NOT IN (?, ?) ORDER BY name', ['admin', 'registrar'], (err, users) => {
    if (err) {
      users = [];
    }

    const userRows = users.map(u => `
      <tr>
        <td>${u.username}</td>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || '-'}</td>
        <td><span class="role-badge ${u.role}">${u.role}</span></td>
        <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <a href="/registrar/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </td>
      </tr>
    `).join('');

    // Mobile card view
    const userCards = users.map(u => `
      <div class="user-card">
        <div class="user-card-header">
          <div>
            <div class="user-card-name">${u.name}</div>
            <div class="user-card-username">@${u.username}</div>
          </div>
        </div>
        <div class="user-card-details">
          <div>${u.email}</div>
          ${u.phone ? `<div>${u.phone}</div>` : ''}
        </div>
        <div class="user-card-badges">
          <span class="role-badge ${u.role}">${u.role}</span>
          <span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="user-card-actions">
          <a href="/registrar/reset-password/${u.id}" class="action-btn edit">Reset Password</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>View Users - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users" class="active">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <h3 class="section-title">Users & Judges</h3>
          <p style="color: #666; margin-bottom: 15px; font-size: 14px;">You can reset passwords for users and judges.</p>

          <!-- Mobile card view -->
          <div class="user-cards">
            ${userCards}
          </div>

          <!-- Table view for larger screens -->
          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${userRows}
              </tbody>
            </table>
          </div>
          <div class="scroll-hint"></div>
        </div>
      </body>
      </html>
    `);
  });
});

// Registrar reset password page
app.get('/registrar/reset-password/:id', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;
  const userId = req.params.id;

  // Get the user but only if they're not an admin or registrar
  db.get('SELECT user_id as id, username, name, role FROM users WHERE user_id = ? AND role NOT IN (?, ?)', [userId, 'admin', 'registrar'], (err, targetUser) => {
    if (err || !targetUser) {
      res.redirect('/registrar/users');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reset Password - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <h3 class="section-title">Reset Password for: ${targetUser.name}</h3>
          <div class="profile-card">
            <p style="margin-bottom: 15px;"><strong>Username:</strong> ${targetUser.username}</p>
            <p style="margin-bottom: 20px;"><strong>Role:</strong> <span class="role-badge ${targetUser.role}">${targetUser.role}</span></p>

            <form method="POST" action="/registrar/reset-password/${targetUser.id}">
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Reset Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle registrar password reset
app.post('/registrar/reset-password/:id', requireRegistrar, (req, res) => {
  const userId = req.params.id;
  const { password, confirm_password } = req.body;

  // First verify the target user is not an admin or registrar
  db.get('SELECT user_id as id, name, role FROM users WHERE user_id = ? AND role NOT IN (?, ?)', [userId, 'admin', 'registrar'], (err, targetUser) => {
    if (err || !targetUser) {
      res.redirect('/registrar/users');
      return;
    }

    if (password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Reset Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Passwords do not match!</div>
            <div class="links">
              <a href="/registrar/reset-password/${userId}">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ? AND role NOT IN (?, ?)', [hashedPassword, userId, 'admin', 'registrar'], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Reset Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error resetting password: ${err.message}</div>
              <div class="links">
                <a href="/registrar/users">Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Reset</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password reset successfully for ${targetUser.name}!</div>
              <div class="links">
                <a href="/registrar/users">Back to Users</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Registrar profile page
app.get('/registrar/profile', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get fresh user data from database
  db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
    if (err || !currentUser) {
      res.redirect('/registrar');
      return;
    }

    const profileImageHtml = currentUser.image_url
      ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
      : `<div class="profile-image-placeholder">${initials}</div>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Profile - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .profile-image-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }
          .profile-image, .profile-image-placeholder {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 15px;
            border: 4px solid #e94560;
          }
          .profile-image-placeholder {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 42px;
            font-weight: 700;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${currentUser.image_url ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile" class="active">My Profile</a>
          </div>

          <div class="profile-card">
            <h3>Profile Picture</h3>
            <div class="profile-image-container">
              ${profileImageHtml}
            </div>
            <form method="POST" action="/registrar/upload-photo" enctype="multipart/form-data">
              <div class="form-group">
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    Click or tap to select an image<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
                <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin-top:10px;border-radius:8px;border:2px solid #e1e1e1;">
              </div>
              <button type="submit">Upload Photo</button>
            </form>
            <script>
              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                const preview = document.getElementById('imagePreview');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                  const reader = new FileReader();
                  reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                  };
                  reader.readAsDataURL(input.files[0]);
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                  preview.style.display = 'none';
                  preview.src = '';
                }
              }
            </script>
          </div>

          <div class="profile-card">
            <h3>Update Email</h3>
            <form method="POST" action="/registrar/update-email">
              <div class="form-group">
                <label>Current Email</label>
                <input type="email" value="${currentUser.email}" disabled>
              </div>
              <div class="form-group">
                <label>New Email Address</label>
                <input type="email" name="email" required placeholder="Enter new email">
              </div>
              <button type="submit">Update Email</button>
            </form>
          </div>

          <div class="profile-card">
            <h3>Change Password</h3>
            <form method="POST" action="/registrar/change-password">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="current_password" required placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="new_password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle registrar profile photo upload
app.post('/registrar/upload-photo', requireRegistrar, upload.single('profile_photo'), async (req, res) => {
  const user = req.session.user;

  if (!req.file) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Please select an image file to upload.</div>
          <div class="links">
            <a href="/registrar/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(__dirname, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    db.get('SELECT image_url FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        const oldPath = path.join(__dirname, row.image_url);
        fs.unlink(oldPath, () => {});
      }

      db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, user.user_id], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Upload Photo - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error saving photo: ${err.message}</div>
                <div class="links">
                  <a href="/registrar/profile">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          req.session.user.image_url = imageUrl;
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Photo Uploaded</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Profile photo uploaded successfully!</div>
                <div class="links">
                  <a href="/registrar/profile">Back to Profile</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Error processing image: ${error.message}</div>
          <div class="links">
            <a href="/registrar/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Handle registrar email update
app.post('/registrar/update-email', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const { email } = req.body;

  db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Email - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating email: ${err.message}</div>
            <div class="links">
              <a href="/registrar/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      req.session.user.email = email;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Updated</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="success-message">Email updated successfully!</div>
            <div class="links">
              <a href="/registrar/profile">Back to Profile</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Handle registrar password change
app.post('/registrar/change-password', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
    if (err || !row) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error retrieving user data.</div>
            <div class="links">
              <a href="/registrar/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (!verifyPassword(current_password, row.password_hash)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Current password is incorrect.</div>
            <div class="links">
              <a href="/registrar/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (new_password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">New passwords do not match.</div>
            <div class="links">
              <a href="/registrar/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const hashedPassword = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.user_id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating password: ${err.message}</div>
              <div class="links">
                <a href="/registrar/profile">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Changed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password changed successfully!</div>
              <div class="links">
                <a href="/registrar/profile">Back to Profile</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Registrar vehicles page - manage voter_id and is_active
app.get('/registrar/vehicles', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all vehicles with owner info and class names
  db.all(`SELECT c.car_id, c.make, c.model, c.description, c.image_url, c.voter_id, c.is_active,
          u.name as owner_name, u.username as owner_username, u.email as owner_email,
          cl.class_name, v.vehicle_name
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          LEFT JOIN classes cl ON c.class_id = cl.class_id
          LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
          ORDER BY c.is_active ASC, c.created_at DESC`, (err, cars) => {
    if (err) {
      cars = [];
    }

    const pendingCount = cars.filter(c => !c.is_active).length;
    const activeCount = cars.filter(c => c.is_active).length;

    const vehicleCards = cars.map(car => `
      <div class="vehicle-card ${car.is_active ? '' : 'pending'}" data-name="${(car.owner_name || '').toLowerCase()}" data-email="${(car.owner_email || '').toLowerCase()}" data-make="${(car.make || '').toLowerCase()}" data-model="${(car.model || '').toLowerCase()}" data-status="${car.is_active ? 'active' : 'pending'}" data-voterid="${car.voter_id || ''}">
        <div class="vehicle-image">
          ${car.image_url
            ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
            : `<div class="vehicle-placeholder">🚗</div>`
          }
        </div>
        <div class="vehicle-info">
          <div class="vehicle-title">${car.make} ${car.model}</div>
          <div class="vehicle-meta">${car.owner_name || 'Unknown'} &mdash; ${car.owner_email || 'N/A'}</div>
          <div class="vehicle-class">
            ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
            ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
            <span class="status-badge ${car.is_active ? 'active' : 'pending'}">${car.is_active ? 'Active' : 'Pending Payment'}</span>
            ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
          </div>
        </div>
        <div class="vehicle-actions">
          <a href="/registrar/edit-vehicle/${car.car_id}" class="action-btn edit">${car.is_active ? 'Edit' : 'Activate'}</a>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vehicles - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            border: 1px solid #e1e1e1;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .vehicle-card.pending {
            border: 2px dashed #f39c12;
            background: #fffbf0;
          }
          .vehicle-image {
            width: 100%;
            height: 120px;
            border-radius: 8px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }
          .vehicle-info {
            flex: 1;
          }
          .vehicle-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 4px;
          }
          .vehicle-meta {
            font-size: 12px;
            color: #888;
            margin-bottom: 8px;
          }
          .vehicle-class {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .type-badge {
            background: #3498db;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .class-badge {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.active {
            background: #27ae60;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-badge.pending {
            background: #f39c12;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .voter-badge {
            background: #9b59b6;
            color: white;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
          }
          .vehicle-actions {
            display: flex;
            gap: 8px;
          }
          .summary-cards {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
          }
          .summary-card {
            background: #f8f9fa;
            padding: 16px;
            border-radius: 12px;
            text-align: center;
          }
          .summary-card.pending-bg {
            background: #fffbf0;
            border: 1px solid #f39c12;
          }
          .summary-number {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a2e;
          }
          .summary-label {
            font-size: 12px;
            color: #666;
          }
          @media (min-width: 768px) {
            .vehicle-card {
              flex-direction: row;
              align-items: center;
            }
            .vehicle-image {
              width: 150px;
              height: 100px;
              flex-shrink: 0;
            }
            .vehicle-actions {
              flex-shrink: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles" class="active">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <div class="summary-cards">
            <div class="summary-card pending-bg">
              <div class="summary-number">${pendingCount}</div>
              <div class="summary-label">Pending Payment</div>
            </div>
            <div class="summary-card">
              <div class="summary-number">${activeCount}</div>
              <div class="summary-label">Active Vehicles</div>
            </div>
          </div>

          <h3 class="section-title">All Vehicles (${cars.length})</h3>

          <div style="margin-bottom:15px;display:flex;gap:8px;flex-wrap:wrap;">
            <input type="text" id="searchFilter" placeholder="Search by name, email, make, model, or voter ID..." oninput="filterVehicles()" style="flex:1;min-width:200px;font-size:16px;">
            <select id="statusFilter" onchange="filterVehicles()" style="min-width:140px;">
              <option value="">All Statuses</option>
              <option value="pending">Pending Payment</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div id="noResults" style="display:none;color:#666;text-align:center;padding:20px;">No vehicles match your filter.</div>

          <div id="vehicleList">
            ${cars.length > 0 ? vehicleCards : '<p style="color: #666; text-align: center; padding: 20px;">No vehicles registered yet.</p>'}
          </div>
        </div>

        <script>
          function filterVehicles() {
            const search = document.getElementById('searchFilter').value.toLowerCase().trim();
            const status = document.getElementById('statusFilter').value;
            const cards = document.querySelectorAll('.vehicle-card');
            let visibleCount = 0;
            cards.forEach(card => {
              const name = card.dataset.name || '';
              const email = card.dataset.email || '';
              const make = card.dataset.make || '';
              const model = card.dataset.model || '';
              const voterid = card.dataset.voterid || '';
              const cardStatus = card.dataset.status || '';

              const matchesSearch = !search || name.includes(search) || email.includes(search) || make.includes(search) || model.includes(search) || voterid.includes(search);
              const matchesStatus = !status || cardStatus === status;

              if (matchesSearch && matchesStatus) {
                card.style.display = '';
                visibleCount++;
              } else {
                card.style.display = 'none';
              }
            });
            document.getElementById('noResults').style.display = visibleCount === 0 && cards.length > 0 ? '' : 'none';
          }
        </script>
      </body>
      </html>
    `);
  });
});

// Registrar edit vehicle page - voter_id and is_active
app.get('/registrar/edit-vehicle/:id', requireRegistrar, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT c.*, u.name as owner_name, u.username as owner_username, u.email as owner_email, u.phone as owner_phone,
          cl.class_name, v.vehicle_name
          FROM cars c
          LEFT JOIN users u ON c.user_id = u.user_id
          LEFT JOIN classes cl ON c.class_id = cl.class_id
          LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
          WHERE c.car_id = ?`, [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/registrar/vehicles');
      return;
    }

    // Get next available voter ID
    db.get('SELECT COALESCE(MAX(voter_id), 0) + 1 as next_id FROM cars WHERE voter_id IS NOT NULL', (err, nextIdRow) => {
    const nextVoterId = nextIdRow ? nextIdRow.next_id : 1;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Vehicle - Registrar Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-preview {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 20px;
          }
          .vehicle-preview-image {
            width: 100%;
            max-width: 300px;
            height: 200px;
            border-radius: 12px;
            overflow: hidden;
            background: #e1e1e1;
          }
          .vehicle-preview-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-preview-placeholder {
            width: 100%;
            max-width: 300px;
            height: 200px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 64px;
          }
          .vehicle-preview-info h4 {
            font-size: 20px;
            margin-bottom: 8px;
            color: #1a1a2e;
          }
          .vehicle-preview-info p {
            color: #666;
            margin-bottom: 4px;
            font-size: 14px;
          }
          .owner-details {
            background: #e8f4fd;
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 20px;
          }
          .owner-details h4 {
            color: #2980b9;
            margin-bottom: 10px;
          }
          .owner-details p {
            margin: 4px 0;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Registrar</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/registrar">Dashboard</a>
            <a href="/registrar/vehicles">Vehicles</a>
            <a href="/registrar/users">View Users</a>
            <a href="/registrar/profile">My Profile</a>
          </div>

          <h3 class="section-title">${car.is_active ? 'Edit' : 'Activate'} Vehicle</h3>

          <div class="vehicle-preview">
            ${car.image_url
              ? `<div class="vehicle-preview-image"><img src="${car.image_url}" alt="${car.make} ${car.model}"></div>`
              : `<div class="vehicle-preview-placeholder">🚗</div>`
            }
            <div class="vehicle-preview-info">
              <h4>${car.make} ${car.model}</h4>
              <p><strong>Type:</strong> ${car.vehicle_name || 'N/A'}</p>
              <p><strong>Class:</strong> ${car.class_name || 'N/A'}</p>
              ${car.description ? `<p>${car.description}</p>` : ''}
            </div>
          </div>

          <div class="owner-details">
            <h4>Owner Information</h4>
            <p><strong>Name:</strong> ${car.owner_name || 'Unknown'}</p>
            <p><strong>Username:</strong> @${car.owner_username || 'N/A'}</p>
            <p><strong>Email:</strong> ${car.owner_email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${car.owner_phone || 'N/A'}</p>
          </div>

          <form method="POST" action="/registrar/edit-vehicle/${car.car_id}">
            <div class="profile-card">
              <div class="form-group">
                <label>Voter ID Number</label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input type="text" name="voter_id" id="voterIdInput" value="${car.voter_id || ''}" placeholder="Assign a voter number" style="flex:1;">
                  <button type="button" onclick="document.getElementById('voterIdInput').value='${nextVoterId}'" style="white-space:nowrap;background:#3498db;padding:10px 16px;">Auto-Assign (#${nextVoterId})</button>
                </div>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="is_active">
                  <option value="0" ${!car.is_active ? 'selected' : ''}>Inactive (Pending Payment)</option>
                  <option value="1" ${car.is_active ? 'selected' : ''}>Active (Payment Received)</option>
                </select>
              </div>
              <button type="submit">${car.is_active ? 'Update Vehicle' : 'Activate Vehicle'}</button>
            </div>
          </form>
        </div>
      </body>
      </html>
    `);
    }); // end nextVoterId query
  });
});

// Handle registrar vehicle update
app.post('/registrar/edit-vehicle/:id', requireRegistrar, (req, res) => {
  const carId = req.params.id;
  const { voter_id, is_active } = req.body;

  // Check if voter_id is unique (if provided)
  if (voter_id && voter_id.trim() !== '') {
    db.get('SELECT car_id FROM cars WHERE voter_id = ? AND car_id != ?', [voter_id, carId], (err, existingCar) => {
      if (existingCar) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Update Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Voter ID "${voter_id}" is already assigned to another vehicle. Each vehicle must have a unique Voter ID.</div>
              <div class="links">
                <a href="/registrar/edit-vehicle/${carId}">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }

      // Voter ID is unique, proceed with update
      updateVehicle();
    });
  } else {
    // No voter_id provided, proceed with update
    updateVehicle();
  }

  function updateVehicle() {
    db.run('UPDATE cars SET voter_id = ?, is_active = ? WHERE car_id = ?', [voter_id || null, is_active, carId], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Update Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating vehicle: ${err.message}</div>
              <div class="links">
                <a href="/registrar/vehicles">Back to Vehicles</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.redirect('/registrar/vehicles');
      }
    });
  }
});

// User page
app.get('/user', requireAuth, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get user's registered vehicles (both active and pending) with class names
  db.all(`SELECT c.car_id, c.make, c.model, c.description, c.image_url, c.is_active,
          cl.class_name, v.vehicle_name
          FROM cars c
          LEFT JOIN classes cl ON c.class_id = cl.class_id
          LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
          WHERE c.user_id = ? ORDER BY c.created_at DESC`, [user.user_id], (err, cars) => {
    if (err) {
      cars = [];
    }

    const vehicleCards = cars.length > 0 ? cars.map(car => `
      <div class="vehicle-card ${car.is_active ? '' : 'pending'}">
        <div class="vehicle-image" ${car.image_url ? `onclick="openImageModal('${car.image_url}', '${car.make} ${car.model}')"` : ''}>
          ${car.image_url
            ? `<img src="${car.image_url}" alt="${car.make} ${car.model}">`
            : `<div class="vehicle-placeholder">🚗</div>`
          }
        </div>
        <div class="vehicle-info">
          <div class="vehicle-title">${car.make} ${car.model}</div>
          <div class="vehicle-class">
            ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
            ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
            ${car.is_active ? '' : '<span class="status-badge pending">Pending Approval</span>'}
          </div>
          ${car.description ? `<div class="vehicle-description">${car.description}</div>` : ''}
        </div>
        <div class="vehicle-actions">
          <a href="/user/edit-vehicle/${car.car_id}" class="action-btn edit">Edit</a>
        </div>
      </div>
    `).join('') : '<p style="color: #666; text-align: center; padding: 20px;">You haven\'t registered any vehicles yet.</p>';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Account - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .vehicle-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 12px;
            border: 1px solid #e1e1e1;
            display: flex;
            flex-direction: row;
            gap: 12px;
            align-items: flex-start;
          }
          .vehicle-image {
            width: 100px;
            height: 75px;
            border-radius: 8px;
            overflow: hidden;
            background: #e1e1e1;
            flex-shrink: 0;
            cursor: pointer;
          }
          .vehicle-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .vehicle-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }
          .vehicle-info {
            flex: 1;
            min-width: 0;
          }
          .vehicle-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 6px;
          }
          .vehicle-class {
            margin-bottom: 6px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
          }
          .type-badge {
            background: #3498db;
            color: white;
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
          }
          .class-badge {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
          }
          .vehicle-description {
            font-size: 12px;
            color: #666;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .vehicle-actions {
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex-shrink: 0;
          }
          .vehicle-actions .action-btn {
            font-size: 12px;
            padding: 6px 12px;
          }
          .register-btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            color: white;
            text-align: center;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            margin-top: 20px;
          }
          .register-btn:active {
            opacity: 0.9;
            transform: scale(0.98);
          }
          .vehicle-card.pending {
            opacity: 0.7;
            border-style: dashed;
          }
          .status-badge.pending {
            background: #f39c12;
            color: white;
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
          }
          /* Fullscreen image modal */
          .image-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          .image-modal.active {
            display: flex;
          }
          .image-modal img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 8px;
          }
          .image-modal-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .image-modal-close:hover {
            background: rgba(255, 255, 255, 0.3);
          }
          @media (min-width: 768px) {
            .vehicle-card {
              padding: 16px;
              align-items: center;
            }
            .vehicle-image {
              width: 200px;
              height: 120px;
            }
            .vehicle-title {
              font-size: 18px;
            }
            .vehicle-placeholder {
              font-size: 48px;
            }
            .type-badge, .class-badge, .status-badge.pending {
              font-size: 12px;
              padding: 4px 12px;
            }
            .vehicle-description {
              font-size: 14px;
            }
            .vehicle-actions {
              flex-direction: row;
            }
            .vehicle-actions .action-btn {
              font-size: 14px;
              padding: 8px 16px;
            }
            .register-btn:hover {
              transform: translateY(-2px);
              box-shadow: 0 10px 30px rgba(39, 174, 96, 0.4);
            }
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Show Manager</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="welcome-card">
            <h2>Welcome, ${user.name}!</h2>
            <p>Manage your registered vehicles for the car show.</p>
          </div>

          <div class="admin-nav">
            <a href="/user" class="active">Dashboard</a>
            <a href="/user/vote">Vote Here!</a>
            <a href="/user/profile">My Profile</a>
          </div>

          <h3 class="section-title">My Registered Vehicles (${cars.length})</h3>

          ${vehicleCards}

          <a href="/user/register-vehicle" class="register-btn">+ Register New Vehicle</a>
        </div>

        <!-- Fullscreen Image Modal -->
        <div class="image-modal" id="imageModal" onclick="closeImageModal()">
          <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
          <img id="modalImage" src="" alt="">
        </div>

        <script>
          function openImageModal(src, alt) {
            const modal = document.getElementById('imageModal');
            const img = document.getElementById('modalImage');
            img.src = src;
            img.alt = alt;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
          }

          function closeImageModal() {
            const modal = document.getElementById('imageModal');
            modal.classList.remove('active');
            document.body.style.overflow = '';
          }

          // Close modal with Escape key
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
              closeImageModal();
            }
          });
        </script>
      </body>
      </html>
    `);
  });
});

// User profile page
app.get('/user/profile', requireAuth, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Get fresh user data from database
  db.get('SELECT user_id as id, username, name, email, phone, image_url FROM users WHERE user_id = ?', [user.user_id], (err, currentUser) => {
    if (err || !currentUser) {
      res.redirect('/user');
      return;
    }

    const profileImageHtml = currentUser.image_url
      ? `<img src="${currentUser.image_url}" alt="Profile" class="profile-image">`
      : `<div class="profile-image-placeholder">${initials}</div>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Profile - Car Show Manager</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
        <style>
          .profile-image-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 20px;
          }
          .profile-image, .profile-image-placeholder {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 15px;
            border: 4px solid #e94560;
          }
          .profile-image-placeholder {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 42px;
            font-weight: 700;
          }
          .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            width: 100%;
          }
          .file-input-wrapper input[type=file] {
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            width: 100%;
            height: 100%;
            cursor: pointer;
          }
          .file-input-label {
            display: block;
            padding: 14px 16px;
            background: #f8f9fa;
            border: 2px dashed #e1e1e1;
            border-radius: 12px;
            text-align: center;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .file-input-wrapper:hover .file-input-label {
            border-color: #e94560;
            background: #fff5f7;
          }
          .file-input-wrapper.has-file .file-input-label {
            border-color: #27ae60;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
          }
          .file-name {
            margin-top: 8px;
            font-size: 13px;
            color: #27ae60;
            text-align: center;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Car Show Manager</h1>
            <div class="user-info">
              <div class="user-avatar">${currentUser.image_url ? `<img src="${currentUser.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initials}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/user">Dashboard</a>
            <a href="/user/vote">Vote Here!</a>
            <a href="/user/profile" class="active">My Profile</a>
          </div>

          <div class="profile-card">
            <h3>Profile Picture</h3>
            <div class="profile-image-container">
              ${profileImageHtml}
            </div>
            <form method="POST" action="/user/upload-photo" enctype="multipart/form-data">
              <div class="form-group">
                <div class="file-input-wrapper" id="fileWrapper">
                  <div class="file-input-label">
                    Click or tap to select an image<br>
                    <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                  </div>
                  <input type="file" name="profile_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                </div>
                <div class="file-name" id="fileName"></div>
                <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin-top:10px;border-radius:8px;border:2px solid #e1e1e1;">
              </div>
              <button type="submit">Upload Photo</button>
            </form>
            <script>
              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                const preview = document.getElementById('imagePreview');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                  const reader = new FileReader();
                  reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                  };
                  reader.readAsDataURL(input.files[0]);
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                  preview.style.display = 'none';
                  preview.src = '';
                }
              }
            </script>
          </div>

          <div class="profile-card">
            <h3>Update Email</h3>
            <form method="POST" action="/user/update-email">
              <div class="form-group">
                <label>Current Email</label>
                <input type="email" value="${currentUser.email}" disabled>
              </div>
              <div class="form-group">
                <label>New Email Address</label>
                <input type="email" name="email" required placeholder="Enter new email">
              </div>
              <button type="submit">Update Email</button>
            </form>
          </div>

          <div class="profile-card">
            <h3>Change Password</h3>
            <form method="POST" action="/user/change-password">
              <div class="form-group">
                <label>Current Password</label>
                <input type="password" name="current_password" required placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label>New Password</label>
                <input type="password" name="new_password" required placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirm_password" required placeholder="Confirm new password">
              </div>
              <button type="submit">Change Password</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Handle profile photo upload
app.post('/user/upload-photo', requireAuth, upload.single('profile_photo'), async (req, res) => {
  const user = req.session.user;

  if (!req.file) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Please select an image file to upload.</div>
          <div class="links">
            <a href="/user/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  try {
    // Generate random filename
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.jpg`;
    const filepath = path.join(__dirname, 'images', 'user_uploads', 'profile', filename);
    const imageUrl = `/images/user_uploads/profile/${filename}`;

    // Process and resize image with sharp
    // .rotate() with no arguments auto-rotates based on EXIF orientation
    await sharp(req.file.buffer)
      .rotate()
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);

    // Get old image to delete if exists
    db.get('SELECT image_url FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
      if (row && row.image_url) {
        // Delete old image file
        const oldPath = path.join(__dirname, row.image_url);
        fs.unlink(oldPath, () => {}); // Ignore errors if file doesn't exist
      }

      // Update database with new image URL
      db.run('UPDATE users SET image_url = ? WHERE user_id = ?', [imageUrl, user.user_id], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Upload Photo - Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error saving photo: ${err.message}</div>
                <div class="links">
                  <a href="/user/profile">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          // Update session with new image URL
          req.session.user.image_url = imageUrl;
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Photo Uploaded</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Profile photo uploaded successfully!</div>
                <div class="links">
                  <a href="/user/profile">Back to Profile</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Photo - Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-icon">🏎️</div>
            <h1>Car Show Manager</h1>
          </div>
          <div class="error-message">Error processing image: ${error.message}</div>
          <div class="links">
            <a href="/user/profile">Try Again</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
});

// Handle user email update
app.post('/user/update-email', requireAuth, (req, res) => {
  const user = req.session.user;
  const { email } = req.body;

  db.run('UPDATE users SET email = ? WHERE user_id = ?', [email, user.user_id], function(err) {
    if (err) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Update Email - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error updating email: ${err.message}</div>
            <div class="links">
              <a href="/user/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
    } else {
      // Update session
      req.session.user.email = email;
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Updated</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="success-message">Email updated successfully!</div>
            <div class="links">
              <a href="/user/profile">Back to Profile</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Handle user password change
app.post('/user/change-password', requireAuth, (req, res) => {
  const user = req.session.user;
  const { current_password, new_password, confirm_password } = req.body;

  // Get current password hash
  db.get('SELECT password_hash FROM users WHERE user_id = ?', [user.user_id], (err, row) => {
    if (err || !row) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error retrieving user data.</div>
            <div class="links">
              <a href="/user/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Verify current password
    if (!verifyPassword(current_password, row.password_hash)) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Current password is incorrect.</div>
            <div class="links">
              <a href="/user/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Check new passwords match
    if (new_password !== confirm_password) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Change Password - Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">New passwords do not match.</div>
            <div class="links">
              <a href="/user/profile">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Update password
    const hashedPassword = hashPassword(new_password);
    db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, user.id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Change Password - Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error updating password: ${err.message}</div>
              <div class="links">
                <a href="/user/profile">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Password Changed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Password changed successfully!</div>
              <div class="links">
                <a href="/user/profile">Back to Profile</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// Register new vehicle page
app.get('/user/register-vehicle', requireAuth, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get active vehicles and classes from database
  db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
    if (err) vehicleTypes = [];

    db.all(`SELECT c.class_id, c.class_name, c.vehicle_id, v.vehicle_name
            FROM classes c
            JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            WHERE c.is_active = 1 AND v.is_active = 1
            ORDER BY v.vehicle_name, c.class_name`, (err, classes) => {
      if (err) classes = [];

      const vehicleOptionsHtml = vehicleTypes.map(v =>
        `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
      ).join('');

      // Group classes by vehicle type for the JavaScript
      const classesJson = JSON.stringify(classes);

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Register Vehicle - Car Show Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          <style>
            .file-input-wrapper {
              position: relative;
              overflow: hidden;
              display: inline-block;
              width: 100%;
            }
            .file-input-wrapper input[type=file] {
              position: absolute;
              left: 0;
              top: 0;
              opacity: 0;
              width: 100%;
              height: 100%;
              cursor: pointer;
            }
            .file-input-label {
              display: block;
              padding: 14px 16px;
              background: #f8f9fa;
              border: 2px dashed #e1e1e1;
              border-radius: 12px;
              text-align: center;
              color: #666;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .file-input-wrapper:hover .file-input-label {
              border-color: #e94560;
              background: #fff5f7;
            }
            .file-input-wrapper.has-file .file-input-label {
              border-color: #27ae60;
              background: rgba(39, 174, 96, 0.1);
              color: #27ae60;
            }
            .file-name {
              margin-top: 8px;
              font-size: 13px;
              color: #27ae60;
              text-align: center;
              font-weight: 600;
            }
            textarea {
              width: 100%;
              padding: 16px;
              border: 2px solid #e1e1e1;
              border-radius: 12px;
              font-size: 16px;
              font-family: inherit;
              resize: vertical;
              min-height: 100px;
              background: #f8f9fa;
            }
            textarea:focus {
              border-color: #e94560;
              outline: none;
              background: #fff;
              box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
            }
          </style>
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Show Manager</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/user">Dashboard</a>
              <a href="/user/vote">Vote Here!</a>
              <a href="/user/profile">My Profile</a>
            </div>

            <h3 class="section-title">Register New Vehicle</h3>

            ${vehicleTypes.length === 0 ? '<div class="error-message">No vehicle types are available. Please contact the administrator.</div>' : ''}

            <form method="POST" action="/user/register-vehicle" enctype="multipart/form-data">
              <div class="profile-card">
                <div class="form-group">
                  <label>Year (Optional)</label>
                  <input type="text" name="year" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="e.g., 1969" style="font-size:16px;">
                </div>
                <div class="form-group">
                  <label>Make *</label>
                  <input type="text" name="make" required placeholder="e.g., Ford, Chevrolet, Toyota">
                </div>
                <div class="form-group">
                  <label>Model *</label>
                  <input type="text" name="model" required placeholder="e.g., Mustang, Camaro, Supra">
                </div>
                <div class="form-group">
                  <label>Vehicle Type *</label>
                  <select name="vehicle_id" id="vehicleType" required onchange="updateClasses()">
                    <option value="">Select vehicle type...</option>
                    ${vehicleOptionsHtml}
                  </select>
                </div>
                <div class="form-group">
                  <label>Class *</label>
                  <select name="class_id" id="classSelect" required>
                    <option value="">Select vehicle type first...</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Description (Optional)</label>
                  <textarea name="description" placeholder="Tell us about your vehicle... year, special features, history, etc."></textarea>
                </div>
                <div class="form-group">
                  <label>Vehicle Photo (Optional)</label>
                  <div class="file-input-wrapper" id="fileWrapper">
                    <div class="file-input-label">
                      Click or tap to select an image<br>
                      <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                    </div>
                    <input type="file" name="vehicle_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                  </div>
                  <div class="file-name" id="fileName"></div>
                  <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin-top:10px;border-radius:8px;border:2px solid #e1e1e1;">
                </div>
                <button type="submit">Register Vehicle</button>
              </div>
            </form>
            <script>
              const allClasses = ${classesJson};

              function updateClasses() {
                const vehicleId = document.getElementById('vehicleType').value;
                const classSelect = document.getElementById('classSelect');
                classSelect.innerHTML = '<option value="">Select a class...</option>';

                if (vehicleId) {
                  const filteredClasses = allClasses.filter(c => c.vehicle_id == vehicleId);
                  filteredClasses.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.class_id;
                    option.textContent = c.class_name;
                    classSelect.appendChild(option);
                  });
                }
              }

              function updateFileName(input) {
                const fileName = document.getElementById('fileName');
                const wrapper = document.getElementById('fileWrapper');
                const preview = document.getElementById('imagePreview');
                if (input.files && input.files[0]) {
                  fileName.textContent = 'Selected: ' + input.files[0].name;
                  wrapper.classList.add('has-file');
                  const reader = new FileReader();
                  reader.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                  };
                  reader.readAsDataURL(input.files[0]);
                } else {
                  fileName.textContent = '';
                  wrapper.classList.remove('has-file');
                  preview.style.display = 'none';
                  preview.src = '';
                }
              }
            </script>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Handle vehicle registration
app.post('/user/register-vehicle', requireAuth, upload.single('vehicle_photo'), async (req, res) => {
  const user = req.session.user;
  const { year, make, model, vehicle_id, class_id, description } = req.body;

  let imageUrl = null;

  // Process image if uploaded
  if (req.file) {
    try {
      const randomName = crypto.randomBytes(16).toString('hex');
      const filename = `${randomName}.jpg`;
      const filepath = path.join(__dirname, 'images', 'user_uploads', 'cars', filename);
      imageUrl = `/images/user_uploads/cars/${filename}`;

      await sharp(req.file.buffer)
        .rotate()
        .resize(800, 600, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toFile(filepath);
    } catch (error) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Registration Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <div class="logo-icon">🏎️</div>
              <h1>Car Show Manager</h1>
            </div>
            <div class="error-message">Error processing image: ${error.message}</div>
            <div class="links">
              <a href="/user/register-vehicle">Try Again</a>
            </div>
          </div>
        </body>
        </html>
      `);
      return;
    }
  }

  // Insert vehicle into database - is_active=0 by default until registrar enables after payment
  db.run('INSERT INTO cars (year, make, model, vehicle_id, class_id, description, image_url, user_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
    [year || null, make, model, vehicle_id, class_id, description || null, imageUrl, user.user_id],
    function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Registration Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error registering vehicle: ${err.message}</div>
              <div class="links">
                <a href="/user/register-vehicle">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Vehicle Registered</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Your ${make} ${model} has been registered successfully!</div>
              <div class="links">
                <a href="/user">Back to My Vehicles</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
});

// Edit vehicle page
app.get('/user/edit-vehicle/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get the vehicle with its current vehicle_id and class_id
  db.get('SELECT car_id, make, model, vehicle_id, class_id, description, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], (err, car) => {
    if (err || !car) {
      res.redirect('/user');
      return;
    }

    // Get active vehicles and classes from database
    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      db.all(`SELECT c.class_id, c.class_name, c.vehicle_id, v.vehicle_name
              FROM classes c
              JOIN vehicles v ON c.vehicle_id = v.vehicle_id
              WHERE c.is_active = 1 AND v.is_active = 1
              ORDER BY v.vehicle_name, c.class_name`, (err, classes) => {
        if (err) classes = [];

        const vehicleOptionsHtml = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}" ${car.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
        ).join('');

        // Filter classes for the current vehicle type
        const currentClasses = classes.filter(c => c.vehicle_id == car.vehicle_id);
        const classOptionsHtml = currentClasses.map(c =>
          `<option value="${c.class_id}" ${car.class_id == c.class_id ? 'selected' : ''}>${c.class_name}</option>`
        ).join('');

        const classesJson = JSON.stringify(classes);

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Edit Vehicle - Car Show Manager</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            <style>
              .current-image {
                width: 100%;
                max-width: 300px;
                border-radius: 12px;
                margin-bottom: 15px;
              }
              .current-image-placeholder {
                width: 100%;
                max-width: 300px;
                height: 150px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
                margin-bottom: 15px;
              }
              .file-input-wrapper {
                position: relative;
                overflow: hidden;
                display: inline-block;
                width: 100%;
              }
              .file-input-wrapper input[type=file] {
                position: absolute;
                left: 0;
                top: 0;
                opacity: 0;
                width: 100%;
                height: 100%;
                cursor: pointer;
              }
              .file-input-label {
                display: block;
                padding: 14px 16px;
                background: #f8f9fa;
                border: 2px dashed #e1e1e1;
                border-radius: 12px;
                text-align: center;
                color: #666;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .file-input-wrapper:hover .file-input-label {
                border-color: #e94560;
                background: #fff5f7;
              }
              .file-input-wrapper.has-file .file-input-label {
                border-color: #27ae60;
                background: rgba(39, 174, 96, 0.1);
                color: #27ae60;
              }
              .file-name {
                margin-top: 8px;
                font-size: 13px;
                color: #27ae60;
                text-align: center;
                font-weight: 600;
              }
              textarea {
                width: 100%;
                padding: 16px;
                border: 2px solid #e1e1e1;
                border-radius: 12px;
                font-size: 16px;
                font-family: inherit;
                resize: vertical;
                min-height: 100px;
                background: #f8f9fa;
              }
              textarea:focus {
                border-color: #e94560;
                outline: none;
                background: #fff;
                box-shadow: 0 0 0 4px rgba(233, 69, 96, 0.1);
              }
              .delete-btn {
                display: block;
                width: 100%;
                padding: 16px;
                background: #e74c3c;
                color: white;
                text-align: center;
                text-decoration: none;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                margin-top: 10px;
                border: none;
                cursor: pointer;
              }
              .delete-btn:active {
                opacity: 0.9;
              }
            </style>
          </head>
          <body>
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Car Show Manager</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/user">Dashboard</a>
                <a href="/user/vote">Vote Here!</a>
                <a href="/user/profile">My Profile</a>
              </div>

              <h3 class="section-title">Edit Vehicle: ${car.make} ${car.model}</h3>

              <form method="POST" action="/user/edit-vehicle/${car.car_id}" enctype="multipart/form-data">
                <div class="profile-card">
                  <div class="form-group">
                    <label>Make *</label>
                    <input type="text" name="make" required value="${car.make}">
                  </div>
                  <div class="form-group">
                    <label>Model *</label>
                    <input type="text" name="model" required value="${car.model}">
                  </div>
                  <div class="form-group">
                    <label>Vehicle Type *</label>
                    <select name="vehicle_id" id="vehicleType" required onchange="updateClasses()">
                      <option value="">Select vehicle type...</option>
                      ${vehicleOptionsHtml}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Class *</label>
                    <select name="class_id" id="classSelect" required>
                      <option value="">Select a class...</option>
                      ${classOptionsHtml}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Description (Optional)</label>
                    <textarea name="description" placeholder="Tell us about your vehicle...">${car.description || ''}</textarea>
                  </div>
                  <div class="form-group">
                    <label>Vehicle Photo</label>
                    ${car.image_url
                      ? `<img src="${car.image_url}" alt="${car.make} ${car.model}" class="current-image">`
                      : `<div class="current-image-placeholder">🚗</div>`
                    }
                    <div class="file-input-wrapper" id="fileWrapper">
                      <div class="file-input-label">
                        ${car.image_url ? 'Upload new image to replace current' : 'Click or tap to select an image'}<br>
                        <small>(JPEG, PNG, GIF, or WebP - Max 5MB)</small>
                      </div>
                      <input type="file" name="vehicle_photo" accept="image/jpeg,image/png,image/gif,image/webp" onchange="updateFileName(this)">
                    </div>
                    <div class="file-name" id="fileName"></div>
                    <img id="imagePreview" style="display:none;max-width:200px;max-height:200px;margin-top:10px;border-radius:8px;border:2px solid #e1e1e1;">
                  </div>
                  <button type="submit">Update Vehicle</button>
                </div>
              </form>

              <form method="POST" action="/user/delete-vehicle/${car.car_id}" onsubmit="return confirm('Are you sure you want to remove this vehicle from the show?');">
                <button type="submit" class="delete-btn">Remove Vehicle</button>
              </form>

              <script>
                const allClasses = ${classesJson};

                function updateClasses() {
                  const vehicleId = document.getElementById('vehicleType').value;
                  const classSelect = document.getElementById('classSelect');
                  classSelect.innerHTML = '<option value="">Select a class...</option>';

                  if (vehicleId) {
                    const filteredClasses = allClasses.filter(c => c.vehicle_id == vehicleId);
                    filteredClasses.forEach(c => {
                      const option = document.createElement('option');
                      option.value = c.class_id;
                      option.textContent = c.class_name;
                      classSelect.appendChild(option);
                    });
                  }
                }

                function updateFileName(input) {
                  const fileName = document.getElementById('fileName');
                  const wrapper = document.getElementById('fileWrapper');
                  const preview = document.getElementById('imagePreview');
                  if (input.files && input.files[0]) {
                    fileName.textContent = 'Selected: ' + input.files[0].name;
                    wrapper.classList.add('has-file');
                    const reader = new FileReader();
                    reader.onload = function(e) {
                      preview.src = e.target.result;
                      preview.style.display = 'block';
                    };
                    reader.readAsDataURL(input.files[0]);
                  } else {
                    fileName.textContent = '';
                    wrapper.classList.remove('has-file');
                    preview.style.display = 'none';
                    preview.src = '';
                  }
                }
              </script>
            </div>
          </body>
          </html>
        `);
      });
    });
  });
});

// Handle vehicle update
app.post('/user/edit-vehicle/:id', requireAuth, upload.single('vehicle_photo'), async (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;
  const { make, model, vehicle_id, class_id, description } = req.body;

  // First verify the car belongs to this user (include pending vehicles)
  db.get('SELECT car_id, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], async (err, car) => {
    if (err || !car) {
      res.redirect('/user');
      return;
    }

    let imageUrl = car.image_url;

    // Process new image if uploaded
    if (req.file) {
      try {
        const randomName = crypto.randomBytes(16).toString('hex');
        const filename = `${randomName}.jpg`;
        const filepath = path.join(__dirname, 'images', 'user_uploads', 'cars', filename);
        imageUrl = `/images/user_uploads/cars/${filename}`;

        await sharp(req.file.buffer)
          .rotate()
          .resize(800, 600, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 85 })
          .toFile(filepath);

        // Delete old image if exists
        if (car.image_url) {
          const oldPath = path.join(__dirname, car.image_url);
          fs.unlink(oldPath, () => {});
        }
      } catch (error) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Update Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error processing image: ${error.message}</div>
              <div class="links">
                <a href="/user/edit-vehicle/${carId}">Try Again</a>
              </div>
            </div>
          </body>
          </html>
        `);
        return;
      }
    }

    // Update vehicle in database
    db.run('UPDATE cars SET make = ?, model = ?, vehicle_id = ?, class_id = ?, description = ?, image_url = ? WHERE car_id = ? AND user_id = ?',
      [make, model, vehicle_id, class_id, description || null, imageUrl, carId, user.user_id],
      function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Update Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error updating vehicle: ${err.message}</div>
                <div class="links">
                  <a href="/user/edit-vehicle/${carId}">Try Again</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Vehicle Updated</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="success-message">Your ${make} ${model} has been updated successfully!</div>
                <div class="links">
                  <a href="/user">Back to My Vehicles</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
  });
});

// Handle vehicle deletion (hard delete for users)
app.post('/user/delete-vehicle/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const carId = req.params.id;

  // First get the vehicle to delete its image
  db.get('SELECT car_id, image_url FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], (err, car) => {
    if (err || !car) {
      res.redirect('/user');
      return;
    }

    // Delete the vehicle
    db.run('DELETE FROM cars WHERE car_id = ? AND user_id = ?', [carId, user.user_id], function(err) {
      if (err) {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Delete Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="error-message">Error removing vehicle: ${err.message}</div>
              <div class="links">
                <a href="/user">Back to My Vehicles</a>
              </div>
            </div>
          </body>
          </html>
        `);
      } else {
        // Delete the image file if exists
        if (car.image_url) {
          const imagePath = path.join(__dirname, car.image_url);
          fs.unlink(imagePath, () => {});
        }

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Vehicle Deleted</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
          </head>
          <body>
            <div class="container">
              <div class="logo">
                <div class="logo-icon">🏎️</div>
                <h1>Car Show Manager</h1>
              </div>
              <div class="success-message">Vehicle has been deleted.</div>
              <div class="links">
                <a href="/user">Back to My Vehicles</a>
              </div>
            </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// ==========================================
// USER SPECIALTY VOTING ROUTES
// ==========================================

// User voting page - shows available specialty votes
app.get('/user/vote', requireAuth, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Find all specialty votes this user can participate in
  // Either allow_all_users=1 OR user is in specialty_vote_voters
  db.all(`
    SELECT DISTINCT sv.specialty_vote_id, sv.vote_name, sv.description
    FROM specialty_votes sv
    LEFT JOIN specialty_vote_voters svv ON sv.specialty_vote_id = svv.specialty_vote_id
    WHERE sv.is_active = 1 AND (sv.allow_all_users = 1 OR svv.user_id = ?)
    ORDER BY sv.vote_name
  `, [user.user_id], (err, availableVotes) => {
    if (err) availableVotes = [];

    // Check which votes the user has already voted in
    db.all('SELECT specialty_vote_id FROM specialty_vote_results WHERE user_id = ?', [user.user_id], (err, completedVotes) => {
      const completedVoteIds = new Set((completedVotes || []).map(v => v.specialty_vote_id));

      // Separate into available and completed
      const pendingVotes = availableVotes.filter(v => !completedVoteIds.has(v.specialty_vote_id));
      const alreadyVoted = availableVotes.filter(v => completedVoteIds.has(v.specialty_vote_id));

      const voteOptions = pendingVotes.length > 0 ? pendingVotes.map(v => `
        <option value="${v.specialty_vote_id}">${v.vote_name}${v.description ? ' - ' + v.description : ''}</option>
      `).join('') : '';

      const completedList = alreadyVoted.length > 0 ? alreadyVoted.map(v => `
        <div style="background:#d4edda;color:#155724;padding:10px;border-radius:8px;margin-bottom:8px;">
          <strong>${v.vote_name}</strong> - You have already voted
        </div>
      `).join('') : '';

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vote Here! - Car Show Manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          <style>
            .vote-select-card {
              background: #f8f9fa;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 20px;
              border: 1px solid #e1e1e1;
            }
            .vote-btn {
              display: block;
              width: 100%;
              padding: 16px;
              background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
              color: white;
              text-align: center;
              text-decoration: none;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              border: none;
              cursor: pointer;
              margin-top: 15px;
            }
            .vote-btn:disabled {
              background: #ccc;
              cursor: not-allowed;
            }
            .no-votes-message {
              text-align: center;
              padding: 40px 20px;
              color: #666;
            }
            .no-votes-message .icon {
              font-size: 48px;
              margin-bottom: 15px;
            }
          </style>
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Car Show Manager</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="welcome-card">
              <h2>Vote Here!</h2>
              <p>Participate in specialty voting for the car show.</p>
            </div>

            <div class="admin-nav">
              <a href="/user">Dashboard</a>
              <a href="/user/vote" class="active">Vote Here!</a>
              <a href="/user/profile">My Profile</a>
            </div>

            ${appConfig.specialtyVotingLocked ? `
              <div class="no-votes-message">
                <div class="icon">🔒</div>
                <h3>Voting is Closed</h3>
                <p>Specialty voting has been locked by the administrator. Results will be announced soon.</p>
              </div>
            ` : pendingVotes.length > 0 ? `
              <div class="vote-select-card">
                <h3 style="margin-bottom:15px;">Select a Vote to Participate In</h3>
                <form action="/user/vote/select" method="POST">
                  <div class="form-group">
                    <label>Available Votes</label>
                    <select name="specialty_vote_id" required>
                      <option value="">Choose a vote...</option>
                      ${voteOptions}
                    </select>
                  </div>
                  <button type="submit" class="vote-btn">Start Voting</button>
                </form>
              </div>
            ` : `
              <div class="no-votes-message">
                <div class="icon">🗳️</div>
                <h3>Not Currently Active</h3>
                <p>You are not currently part of any active specialty votes, or you have already voted in all available categories.</p>
              </div>
            `}

            ${completedList ? `
              <h3 class="section-title" style="margin-top:30px;">Completed Votes</h3>
              ${completedList}
            ` : ''}
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Handle vote selection - redirect to vehicle voting page
app.post('/user/vote/select', requireAuth, (req, res) => {
  const specialtyVoteId = req.body.specialty_vote_id;
  res.redirect(`/user/vote/${specialtyVoteId}`);
});

// Vehicle voting page - shows all registered vehicles for a specific specialty vote
app.get('/user/vote/:id', requireAuth, (req, res) => {
  const user = req.session.user;
  const specialtyVoteId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // First verify the user can participate in this vote
  db.get(`
    SELECT sv.specialty_vote_id, sv.vote_name, sv.description, sv.allow_all_users, sv.vehicle_id, sv.class_id
    FROM specialty_votes sv
    LEFT JOIN specialty_vote_voters svv ON sv.specialty_vote_id = svv.specialty_vote_id AND svv.user_id = ?
    WHERE sv.specialty_vote_id = ? AND sv.is_active = 1 AND (sv.allow_all_users = 1 OR svv.user_id IS NOT NULL)
  `, [user.user_id, specialtyVoteId], (err, vote) => {
    if (err || !vote) {
      res.redirect('/user/vote');
      return;
    }

    // Check if user has already voted
    db.get('SELECT id FROM specialty_vote_results WHERE specialty_vote_id = ? AND user_id = ?',
      [specialtyVoteId, user.user_id], (err, existingVote) => {
      if (existingVote) {
        res.redirect('/user/vote');
        return;
      }

      // Build car query with optional vehicle type and class filters
      let carQuery = `
        SELECT c.car_id, c.year, c.make, c.model, c.description, c.image_url, c.voter_id,
               u.name as owner_name,
               cl.class_name, v.vehicle_name
        FROM cars c
        LEFT JOIN users u ON c.user_id = u.user_id
        LEFT JOIN classes cl ON c.class_id = cl.class_id
        LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
        WHERE c.is_active = 1`;
      const carParams = [];
      if (vote.vehicle_id) {
        carQuery += ' AND c.vehicle_id = ?';
        carParams.push(vote.vehicle_id);
      }
      if (vote.class_id) {
        carQuery += ' AND c.class_id = ?';
        carParams.push(vote.class_id);
      }
      carQuery += ' ORDER BY c.voter_id, c.make, c.model';

      // Get filtered active registered vehicles
      db.all(carQuery, carParams, (err, cars) => {
        if (err) cars = [];

        const vehicleCards = cars.length > 0 ? cars.map(car => `
          <label class="vehicle-vote-card">
            <input type="radio" name="car_id" value="${car.car_id}" required>
            <div class="vehicle-vote-content">
              <div class="vehicle-vote-image">
                ${car.image_url
                  ? `<img src="${car.image_url}" alt="${car.make} ${car.model}" onclick="openImageModal('${car.image_url}', '${car.year || ''} ${car.make} ${car.model}'); event.preventDefault();">`
                  : `<div class="vehicle-placeholder">🚗</div>`
                }
              </div>
              <div class="vehicle-vote-info">
                <div class="vehicle-vote-title">
                  ${car.voter_id ? `<span class="voter-badge">#${car.voter_id}</span>` : ''}
                  ${car.year || ''} ${car.make} ${car.model}
                </div>
                <div class="vehicle-vote-details">
                  ${car.vehicle_name ? `<span class="type-badge">${car.vehicle_name}</span>` : ''}
                  ${car.class_name ? `<span class="class-badge">${car.class_name}</span>` : ''}
                </div>
                ${car.description ? `<div class="vehicle-vote-desc">${car.description}</div>` : ''}
                <div class="vehicle-vote-owner">Owner: ${car.owner_name || 'Unknown'}</div>
              </div>
              <div class="vehicle-vote-check">
                <span class="checkmark"></span>
              </div>
            </div>
          </label>
        `).join('') : '<p style="text-align:center;color:#666;padding:20px;">No vehicles are currently registered.</p>';

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${vote.vote_name} - Car Show Manager</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
            <style>
              .vote-header {
                background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
                color: white;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
              }
              .vote-header h2 {
                color: white;
                margin-bottom: 5px;
              }
              .vehicle-vote-card {
                display: block;
                background: #f8f9fa;
                border-radius: 12px;
                margin-bottom: 12px;
                border: 2px solid #e1e1e1;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .vehicle-vote-card:hover {
                border-color: #e94560;
              }
              .vehicle-vote-card input[type="radio"] {
                display: none;
              }
              .vehicle-vote-card input[type="radio"]:checked + .vehicle-vote-content {
                border-color: #e94560;
                background: #fff5f7;
              }
              .vehicle-vote-card input[type="radio"]:checked + .vehicle-vote-content .checkmark {
                background: #e94560;
                border-color: #e94560;
              }
              .vehicle-vote-card input[type="radio"]:checked + .vehicle-vote-content .checkmark::after {
                display: block;
              }
              .vehicle-vote-content {
                display: flex;
                padding: 12px;
                gap: 12px;
                align-items: center;
                border-radius: 10px;
                border: 2px solid transparent;
              }
              .vehicle-vote-image {
                width: 80px;
                height: 60px;
                border-radius: 8px;
                overflow: hidden;
                background: #e1e1e1;
                flex-shrink: 0;
              }
              .vehicle-vote-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                cursor: zoom-in;
              }
              .vehicle-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              }
              .vehicle-vote-info {
                flex: 1;
                min-width: 0;
              }
              .vehicle-vote-title {
                font-weight: 700;
                font-size: 14px;
                color: #1a1a2e;
                margin-bottom: 4px;
              }
              .vehicle-vote-details {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-bottom: 4px;
              }
              .vehicle-vote-desc {
                font-size: 11px;
                color: #666;
                display: -webkit-box;
                -webkit-line-clamp: 1;
                -webkit-box-orient: vertical;
                overflow: hidden;
              }
              .vehicle-vote-owner {
                font-size: 11px;
                color: #888;
                margin-top: 2px;
              }
              .vehicle-vote-check {
                flex-shrink: 0;
              }
              .checkmark {
                display: block;
                width: 24px;
                height: 24px;
                border: 2px solid #ccc;
                border-radius: 50%;
                position: relative;
              }
              .checkmark::after {
                content: '';
                display: none;
                position: absolute;
                left: 7px;
                top: 3px;
                width: 6px;
                height: 12px;
                border: solid white;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
              }
              .voter-badge {
                background: #2c3e50;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                margin-right: 6px;
              }
              .type-badge {
                background: #3498db;
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: 600;
              }
              .class-badge {
                background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: 600;
              }
              .submit-vote-btn {
                display: block;
                width: 100%;
                padding: 18px;
                background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                color: white;
                text-align: center;
                border: none;
                border-radius: 12px;
                font-weight: 600;
                font-size: 18px;
                cursor: pointer;
                margin-top: 20px;
                position: sticky;
                bottom: 20px;
              }
              .submit-vote-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 30px rgba(39, 174, 96, 0.4);
              }
              .back-link {
                display: block;
                text-align: center;
                margin-top: 15px;
                color: #666;
              }
              /* Fullscreen image modal */
              .image-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 10000;
                justify-content: center;
                align-items: center;
                padding: 20px;
              }
              .image-modal.active {
                display: flex;
              }
              .image-modal img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                border-radius: 8px;
              }
              .image-modal-close {
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: none;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
              }
              @media (min-width: 768px) {
                .vehicle-vote-image {
                  width: 120px;
                  height: 80px;
                }
                .vehicle-vote-title {
                  font-size: 16px;
                }
                .type-badge, .class-badge {
                  font-size: 12px;
                  padding: 3px 10px;
                }
              }
            </style>
          </head>
          <body>
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Car Show Manager</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="vote-header">
                <h2>${vote.vote_name}</h2>
                ${vote.description ? `<p>${vote.description}</p>` : ''}
              </div>

              <p style="color:#666;margin-bottom:15px;text-align:center;">Select the vehicle you want to vote for, then click Submit Vote.</p>

              <form action="/user/vote/${specialtyVoteId}/submit" method="POST">
                ${vehicleCards}
                ${cars.length > 0 ? '<button type="submit" class="submit-vote-btn">Submit Vote</button>' : ''}
              </form>

              <a href="/user/vote" class="back-link">Cancel and go back</a>
            </div>

            <!-- Fullscreen Image Modal -->
            <div class="image-modal" id="imageModal" onclick="closeImageModal()">
              <button class="image-modal-close" onclick="closeImageModal()">&times;</button>
              <img id="modalImage" src="" alt="">
            </div>

            <script>
              function openImageModal(src, alt) {
                const modal = document.getElementById('imageModal');
                const img = document.getElementById('modalImage');
                img.src = src;
                img.alt = alt;
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
              }

              function closeImageModal() {
                const modal = document.getElementById('imageModal');
                modal.classList.remove('active');
                document.body.style.overflow = '';
              }

              document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                  closeImageModal();
                }
              });
            </script>
          </body>
          </html>
        `);
      });
    });
  });
});

// Handle vote submission
app.post('/user/vote/:id/submit', requireAuth, (req, res) => {
  const user = req.session.user;
  const specialtyVoteId = req.params.id;
  const carId = req.body.car_id;

  // Check if voting is locked
  if (appConfig.specialtyVotingLocked) {
    res.redirect('/user/vote');
    return;
  }

  if (!carId) {
    res.redirect(`/user/vote/${specialtyVoteId}`);
    return;
  }

  // Verify user can vote in this specialty vote
  db.get(`
    SELECT sv.specialty_vote_id, sv.vote_name
    FROM specialty_votes sv
    LEFT JOIN specialty_vote_voters svv ON sv.specialty_vote_id = svv.specialty_vote_id AND svv.user_id = ?
    WHERE sv.specialty_vote_id = ? AND sv.is_active = 1 AND (sv.allow_all_users = 1 OR svv.user_id IS NOT NULL)
  `, [user.user_id, specialtyVoteId], (err, vote) => {
    if (err || !vote) {
      res.redirect('/user/vote');
      return;
    }

    // Check if user has already voted
    db.get('SELECT id FROM specialty_vote_results WHERE specialty_vote_id = ? AND user_id = ?',
      [specialtyVoteId, user.user_id], (err, existingVote) => {
      if (existingVote) {
        res.redirect('/user/vote');
        return;
      }

      // Insert the vote
      db.run('INSERT INTO specialty_vote_results (specialty_vote_id, user_id, car_id) VALUES (?, ?, ?)',
        [specialtyVoteId, user.user_id, carId], function(err) {
        if (err) {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Vote Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🏎️</div>
                  <h1>Car Show Manager</h1>
                </div>
                <div class="error-message">Error submitting vote. You may have already voted in this category.</div>
                <div class="links">
                  <a href="/user/vote">Back to Voting</a>
                </div>
              </div>
            </body>
            </html>
          `);
        } else {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Vote Submitted!</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
            </head>
            <body>
              <div class="container">
                <div class="logo">
                  <div class="logo-icon">🎉</div>
                  <h1>Vote Submitted!</h1>
                </div>
                <div class="success-message">Thank you! Your vote for "${vote.vote_name}" has been recorded.</div>
                <div class="links">
                  <a href="/user/vote">Vote in Another Category</a>
                  <a href="/user">Back to Dashboard</a>
                </div>
              </div>
            </body>
            </html>
          `);
        }
      });
    });
  });
});

// ==========================================
// ADMIN CONFIGURATION MANAGEMENT ROUTES
// ==========================================

// Admin Vehicle Config page (combines Vehicle Types and Classes)
app.get('/admin/vehicle-config', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get vehicle types
  db.all('SELECT * FROM vehicles ORDER BY vehicle_name', (err, vehicleTypes) => {
    if (err) vehicleTypes = [];

    // Get classes with vehicle names
    db.all(`SELECT c.*, v.vehicle_name
            FROM classes c
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            ORDER BY v.vehicle_name, c.class_name`, (err, classes) => {
      if (err) classes = [];

      // Check which vehicle types have classes (for delete validation)
      db.all('SELECT DISTINCT vehicle_id FROM classes', (err, usedVehicleIds) => {
        const usedVehicleSet = new Set((usedVehicleIds || []).map(r => r.vehicle_id));

        // Check which classes have cars
        db.all('SELECT DISTINCT class_id FROM cars', (err, usedClassIds) => {
          const usedClassSet = new Set((usedClassIds || []).map(r => r.class_id));

          const vehicleRows = vehicleTypes.map(v => {
            const hasClasses = usedVehicleSet.has(v.vehicle_id);
            return `
              <tr>
                <td>${v.vehicle_name}</td>
                <td><span class="status-badge ${v.is_active ? 'active' : 'inactive'}">${v.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <a href="/admin/edit-vehicle-type/${v.vehicle_id}" class="action-btn edit">Edit</a>
                  ${!hasClasses ? `<a href="#" onclick="confirmDeleteVehicleType(${v.vehicle_id}, '${v.vehicle_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>` : ''}
                </td>
              </tr>
            `;
          }).join('');

          const classRows = classes.map(c => {
            const hasCars = usedClassSet.has(c.class_id);
            return `
              <tr>
                <td>${c.class_name}</td>
                <td>${c.vehicle_name || 'N/A'}</td>
                <td><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <a href="/admin/edit-class/${c.class_id}" class="action-btn edit">Edit</a>
                  ${!hasCars ? `<a href="#" onclick="confirmDeleteClass(${c.class_id}, '${c.class_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>` : ''}
                </td>
              </tr>
            `;
          }).join('');

          const vehicleOptionsHtml = vehicleTypes.filter(v => v.is_active).map(v =>
            `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
          ).join('');

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Vehicle Config - Admin</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${adminStyles}
            </head>
            <body>
              <div class="container dashboard-container">
                <div class="dashboard-header">
                  <h1>🏎️ Admin Dashboard</h1>
                  <div class="user-info">
                    <div class="user-avatar">${avatarContent}</div>
                    <a href="/logout" class="logout-btn">Sign Out</a>
                  </div>
                </div>

                <div class="admin-nav">
                  <a href="/admin/app-config">App Config</a>
                  <a href="/admin/vehicle-config" class="active">Vehicle Config</a>
                  <a href="/admin/categories">Judge Config</a>
                  <a href="/admin/specialty-votes">Special Vote Config</a>
                  <a href="/admin">Users</a>
                  <a href="/admin/vehicles">Cars</a>
                  <a href="/admin/judge-status">Judge Status</a>
                  <a href="/admin/vote-status">Vote Status</a>
                  <a href="/admin/reports">Reports</a>
                  <a href="/admin/profile">Profile</a>
                </div>

                <h3 class="section-title">Vehicle Types</h3>
                <p style="color:#666;margin-bottom:15px;">Define types like Car, Truck, Motorcycle, etc.</p>

                <form method="POST" action="/admin/add-vehicle-type" style="margin-bottom:20px;">
                  <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <input type="text" name="vehicle_name" required placeholder="New vehicle type name" style="flex:1;min-width:200px;">
                    <button type="submit" style="white-space:nowrap;">Add Type</button>
                  </div>
                </form>

                <div class="table-wrapper">
                  <table class="user-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${vehicleRows || '<tr><td colspan="3" style="text-align:center;color:#666;">No vehicle types defined yet.</td></tr>'}
                    </tbody>
                  </table>
                </div>

                <hr style="margin:30px 0;border:none;border-top:1px solid #ddd;">

                <h3 class="section-title">Vehicle Classes</h3>
                <p style="color:#666;margin-bottom:15px;">Define classes like Street Rod, Muscle Car, Custom, etc.</p>

                <form method="POST" action="/admin/add-class" style="margin-bottom:20px;">
                  <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <select name="vehicle_id" required style="min-width:150px;">
                      <option value="">Select Type...</option>
                      ${vehicleOptionsHtml}
                    </select>
                    <input type="text" name="class_name" required placeholder="New class name" style="flex:1;min-width:200px;">
                    <button type="submit" style="white-space:nowrap;">Add Class</button>
                  </div>
                </form>

                <div class="table-wrapper">
                  <table class="user-table">
                    <thead>
                      <tr>
                        <th>Class Name</th>
                        <th>Vehicle Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${classRows || '<tr><td colspan="4" style="text-align:center;color:#666;">No classes defined yet.</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>

              <script>
                function confirmDeleteVehicleType(id, name) {
                  if (confirm('Are you sure you want to delete the vehicle type "' + name + '"?\\n\\nThis action cannot be undone.')) {
                    window.location.href = '/admin/delete-vehicle-type/' + id;
                  }
                }

                function confirmDeleteClass(id, name) {
                  if (confirm('Are you sure you want to delete the class "' + name + '"?\\n\\nThis action cannot be undone.')) {
                    window.location.href = '/admin/delete-class/' + id;
                  }
                }
              </script>
            </body>
            </html>
          `);
        });
      });
    });
  });
});

// Admin vehicle types management page (legacy - redirects to vehicle-config)
app.get('/admin/vehicle-types', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.all('SELECT * FROM vehicles ORDER BY vehicle_name', (err, vehicleTypes) => {
    if (err) vehicleTypes = [];

    const rows = vehicleTypes.map(v => `
      <tr>
        <td>${v.vehicle_name}</td>
        <td><span class="status-badge ${v.is_active ? 'active' : 'inactive'}">${v.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <a href="/admin/edit-vehicle-type/${v.vehicle_id}" class="action-btn edit">Edit</a>
        </td>
      </tr>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Vehicle Types - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config" class="active">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">Vehicle Types</h3>
          <p style="color:#666;margin-bottom:15px;">Define types like Car, Truck, Motorcycle, etc.</p>

          <form method="POST" action="/admin/add-vehicle-type" style="margin-bottom:20px;">
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <input type="text" name="vehicle_name" required placeholder="New vehicle type name" style="flex:1;min-width:200px;">
              <button type="submit" style="white-space:nowrap;">Add Type</button>
            </div>
          </form>

          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="3" style="text-align:center;color:#666;">No vehicle types defined yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Add vehicle type
app.post('/admin/add-vehicle-type', requireAdmin, (req, res) => {
  const { vehicle_name } = req.body;
  db.run('INSERT INTO vehicles (vehicle_name) VALUES (?)', [vehicle_name], (err) => {
    res.redirect('/admin/vehicle-config');
  });
});

// Delete vehicle type (only if no classes use it)
app.get('/admin/delete-vehicle-type/:id', requireAdmin, (req, res) => {
  const vehicleId = req.params.id;

  // Check if any classes use this vehicle type
  db.get('SELECT COUNT(*) as count FROM classes WHERE vehicle_id = ?', [vehicleId], (err, row) => {
    if (err || row.count > 0) {
      // Has classes, cannot delete
      res.redirect('/admin/vehicle-config');
      return;
    }

    // Safe to delete
    db.run('DELETE FROM vehicles WHERE vehicle_id = ?', [vehicleId], (err) => {
      res.redirect('/admin/vehicle-config');
    });
  });
});

// Edit vehicle type page
app.get('/admin/edit-vehicle-type/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const vehicleId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get('SELECT * FROM vehicles WHERE vehicle_id = ?', [vehicleId], (err, vehicle) => {
    if (err || !vehicle) {
      res.redirect('/admin/vehicle-config');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Vehicle Type - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">Edit Vehicle Type</h3>

          <form method="POST" action="/admin/edit-vehicle-type/${vehicle.vehicle_id}">
            <div class="profile-card">
              <div class="form-group">
                <label>Name</label>
                <input type="text" name="vehicle_name" required value="${vehicle.vehicle_name}">
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="is_active">
                  <option value="1" ${vehicle.is_active ? 'selected' : ''}>Active</option>
                  <option value="0" ${!vehicle.is_active ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
              <button type="submit">Update Vehicle Type</button>
            </div>
          </form>

          <div class="links" style="margin-top:20px;">
            <a href="/admin/vehicle-config">Back to Vehicle Config</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Update vehicle type
app.post('/admin/edit-vehicle-type/:id', requireAdmin, (req, res) => {
  const vehicleId = req.params.id;
  const { vehicle_name, is_active } = req.body;
  db.run('UPDATE vehicles SET vehicle_name = ?, is_active = ? WHERE vehicle_id = ?',
    [vehicle_name, is_active, vehicleId], (err) => {
    res.redirect('/admin/vehicle-config');
  });
});

// Admin classes management page
app.get('/admin/classes', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
    if (err) vehicleTypes = [];

    db.all(`SELECT c.*, v.vehicle_name
            FROM classes c
            LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
            ORDER BY v.vehicle_name, c.class_name`, (err, classes) => {
      if (err) classes = [];

      const rows = classes.map(c => `
        <tr>
          <td>${c.class_name}</td>
          <td>${c.vehicle_name || 'N/A'}</td>
          <td><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <a href="/admin/edit-class/${c.class_id}" class="action-btn edit">Edit</a>
          </td>
        </tr>
      `).join('');

      const vehicleOptionsHtml = vehicleTypes.map(v =>
        `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
      ).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Classes - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config" class="active">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">Vehicle Classes</h3>
            <p style="color:#666;margin-bottom:15px;">Define classes like Street Rod, Muscle Car, Custom, etc.</p>

            <form method="POST" action="/admin/add-class" style="margin-bottom:20px;">
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <select name="vehicle_id" required style="min-width:150px;">
                  <option value="">Select Type...</option>
                  ${vehicleOptionsHtml}
                </select>
                <input type="text" name="class_name" required placeholder="New class name" style="flex:1;min-width:200px;">
                <button type="submit" style="white-space:nowrap;">Add Class</button>
              </div>
            </form>

            <div class="table-wrapper">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Class Name</th>
                    <th>Vehicle Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="4" style="text-align:center;color:#666;">No classes defined yet.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Add class
app.post('/admin/add-class', requireAdmin, (req, res) => {
  const { vehicle_id, class_name } = req.body;
  db.run('INSERT INTO classes (vehicle_id, class_name) VALUES (?, ?)', [vehicle_id, class_name], (err) => {
    res.redirect('/admin/vehicle-config');
  });
});

// Delete class (only if no cars use it)
app.get('/admin/delete-class/:id', requireAdmin, (req, res) => {
  const classId = req.params.id;

  // Check if any cars use this class
  db.get('SELECT COUNT(*) as count FROM cars WHERE class_id = ?', [classId], (err, row) => {
    if (err || row.count > 0) {
      // Has cars, cannot delete
      res.redirect('/admin/vehicle-config');
      return;
    }

    // Safe to delete
    db.run('DELETE FROM classes WHERE class_id = ?', [classId], (err) => {
      res.redirect('/admin/vehicle-config');
    });
  });
});

// Edit class page
app.get('/admin/edit-class/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const classId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get('SELECT * FROM classes WHERE class_id = ?', [classId], (err, classItem) => {
    if (err || !classItem) {
      res.redirect('/admin/vehicle-config');
      return;
    }

    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      const vehicleOptionsHtml = vehicleTypes.map(v =>
        `<option value="${v.vehicle_id}" ${classItem.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
      ).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Class - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">Edit Class</h3>

            <form method="POST" action="/admin/edit-class/${classItem.class_id}">
              <div class="profile-card">
                <div class="form-group">
                  <label>Vehicle Type</label>
                  <select name="vehicle_id" required>
                    ${vehicleOptionsHtml}
                  </select>
                </div>
                <div class="form-group">
                  <label>Class Name</label>
                  <input type="text" name="class_name" required value="${classItem.class_name}">
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select name="is_active">
                    <option value="1" ${classItem.is_active ? 'selected' : ''}>Active</option>
                    <option value="0" ${!classItem.is_active ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
                <button type="submit">Update Class</button>
              </div>
            </form>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/vehicle-config">Back to Vehicle Config</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Update class
app.post('/admin/edit-class/:id', requireAdmin, (req, res) => {
  const classId = req.params.id;
  const { vehicle_id, class_name, is_active } = req.body;
  db.run('UPDATE classes SET vehicle_id = ?, class_name = ?, is_active = ? WHERE class_id = ?',
    [vehicle_id, class_name, is_active, classId], (err) => {
    res.redirect('/admin/vehicle-config');
  });
});

// Admin judge categories management page
app.get('/admin/categories', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
    if (err) vehicleTypes = [];

    db.all(`SELECT jc.*, v.vehicle_name,
                   (SELECT COUNT(*) FROM judge_questions jq WHERE jq.judge_catagory_id = jc.judge_catagory_id) as question_count
            FROM judge_catagories jc
            LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
            ORDER BY v.vehicle_name, jc.display_order, jc.catagory_name`, (err, categories) => {
      if (err) categories = [];

      const rows = categories.map(c => `
        <tr>
          <td>${c.catagory_name}</td>
          <td>${c.vehicle_name || 'N/A'}</td>
          <td>${c.display_order}</td>
          <td>${c.question_count}</td>
          <td><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
        <tr>
          <td colspan="5" style="border-top:none;padding-top:0;">
            <a href="/admin/edit-category/${c.judge_catagory_id}" class="action-btn edit">Edit</a>
            <a href="/admin/category-questions/${c.judge_catagory_id}" class="action-btn" style="background:#3498db;">Questions</a>
            <a href="#" onclick="confirmDeleteCategory(${c.judge_catagory_id}, '${c.catagory_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>
          </td>
        </tr>
      `).join('');

      const vehicleOptionsHtml = vehicleTypes.map(v =>
        `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
      ).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Judging Categories - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories" class="active">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">Judging Categories</h3>
            <p style="color:#666;margin-bottom:15px;">Define judging categories like Engine, Paint, Interior, etc.</p>

            <form method="POST" action="/admin/add-category" style="margin-bottom:20px;">
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <select name="vehicle_id" required style="min-width:150px;">
                  <option value="">Select Type...</option>
                  ${vehicleOptionsHtml}
                </select>
                <input type="text" name="catagory_name" required placeholder="Category name" style="flex:1;min-width:150px;">
                <input type="number" name="display_order" value="0" placeholder="Order" style="width:80px;">
                <button type="submit" style="white-space:nowrap;">Add Category</button>
              </div>
            </form>

            <div class="table-wrapper">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Vehicle Type</th>
                    <th>Order</th>
                    <th>Questions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="5" style="text-align:center;color:#666;">No categories defined yet.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <script>
            function confirmDeleteCategory(id, name) {
              if (confirm('Are you sure you want to delete the category "' + name + '"?\\n\\nThis will also delete ALL questions in this category.\\n\\nThis action cannot be undone.')) {
                window.location.href = '/admin/delete-category/' + id;
              }
            }
          </script>
        </body>
        </html>
      `);
    });
  });
});

// Add category
app.post('/admin/add-category', requireAdmin, (req, res) => {
  const { vehicle_id, catagory_name, display_order } = req.body;
  db.run('INSERT INTO judge_catagories (vehicle_id, catagory_name, display_order) VALUES (?, ?, ?)',
    [vehicle_id, catagory_name, display_order || 0], (err) => {
    res.redirect('/admin/categories');
  });
});

// Delete category (also deletes all questions in this category)
app.get('/admin/delete-category/:id', requireAdmin, (req, res) => {
  const categoryId = req.params.id;

  // First delete all questions for this category
  db.run('DELETE FROM judge_questions WHERE judge_catagory_id = ?', [categoryId], (err) => {
    // Then delete the category itself
    db.run('DELETE FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err) => {
      res.redirect('/admin/categories');
    });
  });
});

// Edit category page
app.get('/admin/edit-category/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const categoryId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get('SELECT * FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err, category) => {
    if (err || !category) {
      res.redirect('/admin/categories');
      return;
    }

    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];

      const vehicleOptionsHtml = vehicleTypes.map(v =>
        `<option value="${v.vehicle_id}" ${category.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
      ).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Edit Category - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">Edit Category</h3>

            <form method="POST" action="/admin/edit-category/${category.judge_catagory_id}">
              <div class="profile-card">
                <div class="form-group">
                  <label>Vehicle Type</label>
                  <select name="vehicle_id" required>
                    ${vehicleOptionsHtml}
                  </select>
                </div>
                <div class="form-group">
                  <label>Category Name</label>
                  <input type="text" name="catagory_name" required value="${category.catagory_name}">
                </div>
                <div class="form-group">
                  <label>Display Order</label>
                  <input type="number" name="display_order" value="${category.display_order}">
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select name="is_active">
                    <option value="1" ${category.is_active ? 'selected' : ''}>Active</option>
                    <option value="0" ${!category.is_active ? 'selected' : ''}>Inactive</option>
                  </select>
                </div>
                <button type="submit">Update Category</button>
              </div>
            </form>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/categories">Back to Judge Config</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Update category
app.post('/admin/edit-category/:id', requireAdmin, (req, res) => {
  const categoryId = req.params.id;
  const { vehicle_id, catagory_name, display_order, is_active } = req.body;
  db.run('UPDATE judge_catagories SET vehicle_id = ?, catagory_name = ?, display_order = ?, is_active = ? WHERE judge_catagory_id = ?',
    [vehicle_id, catagory_name, display_order || 0, is_active, categoryId], (err) => {
    res.redirect('/admin/categories');
  });
});

// Category questions page
app.get('/admin/category-questions/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const categoryId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT jc.*, v.vehicle_name
          FROM judge_catagories jc
          LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
          WHERE jc.judge_catagory_id = ?`, [categoryId], (err, category) => {
    if (err || !category) {
      res.redirect('/admin/categories');
      return;
    }

    db.all(`SELECT * FROM judge_questions WHERE judge_catagory_id = ? ORDER BY display_order, question`,
      [categoryId], (err, questions) => {
      if (err) questions = [];

      const rows = questions.map(q => `
        <tr>
          <td>${q.question}</td>
          <td>${q.min_score} - ${q.max_score}</td>
          <td>${q.display_order}</td>
          <td><span class="status-badge ${q.is_active ? 'active' : 'inactive'}">${q.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <a href="/admin/edit-question/${q.judge_question_id}" class="action-btn edit">Edit</a>
            <a href="#" onclick="confirmDeleteQuestion(${q.judge_question_id}, '${q.question.replace(/'/g, "\\'")}', ${categoryId}); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>
          </td>
        </tr>
      `).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Questions: ${category.catagory_name} - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">Questions: ${category.catagory_name}</h3>
            <p style="color:#666;margin-bottom:15px;">Vehicle Type: ${category.vehicle_name}</p>

            <form method="POST" action="/admin/add-question/${category.judge_catagory_id}" style="margin-bottom:20px;">
              <div class="profile-card">
                <div class="form-group">
                  <label>Question</label>
                  <input type="text" name="question" required placeholder="e.g., Condition of paint finish">
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Min Score</label>
                    <input type="number" name="min_score" value="0" required>
                  </div>
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Max Score</label>
                    <input type="number" name="max_score" value="10" required>
                  </div>
                  <div class="form-group" style="flex:1;min-width:100px;">
                    <label>Order</label>
                    <input type="number" name="display_order" value="0">
                  </div>
                </div>
                <button type="submit">Add Question</button>
              </div>
            </form>

            <div class="table-wrapper">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Score Range</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="5" style="text-align:center;color:#666;">No questions defined yet.</td></tr>'}
                </tbody>
              </table>
            </div>

            <div class="links" style="margin-top:20px;">
              <a href="/admin/categories">Back to Judge Config</a>
            </div>
          </div>

          <script>
            function confirmDeleteQuestion(id, name, categoryId) {
              if (confirm('Are you sure you want to delete this question?\\n\\n"' + name + '"\\n\\nThis action cannot be undone.')) {
                window.location.href = '/admin/delete-question/' + id + '?categoryId=' + categoryId;
              }
            }
          </script>
        </body>
        </html>
      `);
    });
  });
});

// Add question
app.post('/admin/add-question/:categoryId', requireAdmin, (req, res) => {
  const categoryId = req.params.categoryId;
  const { question, min_score, max_score, display_order } = req.body;

  // Get the vehicle_id from the category
  db.get('SELECT vehicle_id FROM judge_catagories WHERE judge_catagory_id = ?', [categoryId], (err, category) => {
    if (err || !category) {
      res.redirect('/admin/categories');
      return;
    }

    db.run('INSERT INTO judge_questions (vehicle_id, judge_catagory_id, question, min_score, max_score, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      [category.vehicle_id, categoryId, question, min_score, max_score, display_order || 0], (err) => {
      res.redirect(`/admin/category-questions/${categoryId}`);
    });
  });
});

// Delete question
app.get('/admin/delete-question/:id', requireAdmin, (req, res) => {
  const questionId = req.params.id;
  const categoryId = req.query.categoryId;

  db.run('DELETE FROM judge_questions WHERE judge_question_id = ?', [questionId], (err) => {
    res.redirect(`/admin/category-questions/${categoryId}`);
  });
});

// Edit question page
app.get('/admin/edit-question/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const questionId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT jq.*, jc.catagory_name
          FROM judge_questions jq
          LEFT JOIN judge_catagories jc ON jq.judge_catagory_id = jc.judge_catagory_id
          WHERE jq.judge_question_id = ?`, [questionId], (err, question) => {
    if (err || !question) {
      res.redirect('/admin/categories');
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Question - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">Edit Question</h3>
          <p style="color:#666;margin-bottom:15px;">Category: ${question.catagory_name}</p>

          <form method="POST" action="/admin/edit-question/${question.judge_question_id}">
            <input type="hidden" name="judge_catagory_id" value="${question.judge_catagory_id}">
            <div class="profile-card">
              <div class="form-group">
                <label>Question</label>
                <input type="text" name="question" required value="${question.question}">
              </div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:100px;">
                  <label>Min Score</label>
                  <input type="number" name="min_score" value="${question.min_score}" required>
                </div>
                <div class="form-group" style="flex:1;min-width:100px;">
                  <label>Max Score</label>
                  <input type="number" name="max_score" value="${question.max_score}" required>
                </div>
                <div class="form-group" style="flex:1;min-width:100px;">
                  <label>Order</label>
                  <input type="number" name="display_order" value="${question.display_order}">
                </div>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="is_active">
                  <option value="1" ${question.is_active ? 'selected' : ''}>Active</option>
                  <option value="0" ${!question.is_active ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
              <button type="submit">Update Question</button>
            </div>
          </form>

          <div class="links" style="margin-top:20px;">
            <a href="/admin/category-questions/${question.judge_catagory_id}">Back to Questions</a>
          </div>
        </div>
      </body>
      </html>
    `);
  });
});

// Update question
app.post('/admin/edit-question/:id', requireAdmin, (req, res) => {
  const questionId = req.params.id;
  const { judge_catagory_id, question, min_score, max_score, display_order, is_active } = req.body;
  db.run('UPDATE judge_questions SET question = ?, min_score = ?, max_score = ?, display_order = ?, is_active = ? WHERE judge_question_id = ?',
    [question, min_score, max_score, display_order || 0, is_active, questionId], (err) => {
    res.redirect(`/admin/category-questions/${judge_catagory_id}`);
  });
});

// ==========================================
// SPECIALTY VOTE CONFIG ROUTES
// ==========================================

// Admin specialty votes management page
app.get('/admin/specialty-votes', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get vehicle types and classes for the form
  db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
    if (err) vehicleTypes = [];
    db.all('SELECT class_id, class_name, vehicle_id FROM classes WHERE is_active = 1 ORDER BY class_name', (err, classes) => {
      if (err) classes = [];

  const vehicleOptionsHtml = vehicleTypes.map(v =>
    `<option value="${v.vehicle_id}">${v.vehicle_name}</option>`
  ).join('');
  const classesJson = JSON.stringify(classes);

  // Get specialty votes with vote counts
  db.all(`
    SELECT sv.*,
           (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as vote_count,
           v.vehicle_name, cl.class_name
    FROM specialty_votes sv
    LEFT JOIN vehicles v ON sv.vehicle_id = v.vehicle_id
    LEFT JOIN classes cl ON sv.class_id = cl.class_id
    ORDER BY sv.vote_name
  `, (err, specialtyVotes) => {
    if (err) specialtyVotes = [];

    const rows = specialtyVotes.map(sv => {
      const filterLabel = sv.vehicle_name
        ? (sv.class_name ? `${sv.vehicle_name} / ${sv.class_name}` : sv.vehicle_name)
        : 'All Vehicles';
      return `
      <tr>
        <td>${sv.vote_name}</td>
        <td>${sv.description || '-'}</td>
        <td>${sv.allow_all_users ? 'All Users' : 'Specific Users'}</td>
        <td>${filterLabel}</td>
        <td><span style="background:#27ae60;color:white;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">${sv.vote_count} votes</span></td>
        <td><span class="status-badge ${sv.is_active ? 'active' : 'inactive'}">${sv.is_active ? 'Active' : 'Inactive'}</span></td>
      </tr>
      <tr>
        <td colspan="6" style="border-top:none;padding-top:0;">
          <a href="/admin/specialty-vote-results/${sv.specialty_vote_id}" class="action-btn" style="background:#27ae60;">Results</a>
          <a href="/admin/edit-specialty-vote/${sv.specialty_vote_id}" class="action-btn edit">Edit</a>
          <a href="/admin/specialty-vote-voters/${sv.specialty_vote_id}" class="action-btn" style="background:#3498db;">Voters</a>
          <a href="#" onclick="confirmDeleteSpecialtyVote(${sv.specialty_vote_id}, '${sv.vote_name.replace(/'/g, "\\'")}'); return false;" class="action-btn" style="background:#e74c3c;">Delete</a>
        </td>
      </tr>
    `}).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Special Vote Config - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes" class="active">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">Special Vote Config</h3>
          <p style="color:#666;margin-bottom:15px;">Configure special voting categories like People's Choice, Best in Show, etc.</p>

          <form method="POST" action="/admin/add-specialty-vote" style="margin-bottom:20px;">
            <div class="profile-card">
              <div class="form-group">
                <label>Vote Name</label>
                <input type="text" name="vote_name" required placeholder="e.g., People's Choice">
              </div>
              <div class="form-group">
                <label>Description (Optional)</label>
                <input type="text" name="description" placeholder="Brief description of this vote">
              </div>
              <div class="form-group">
                <label>Who Can Vote?</label>
                <select name="allow_all_users">
                  <option value="0">Specific Users Only</option>
                  <option value="1">All Users</option>
                </select>
              </div>
              <div class="form-group">
                <label>Limit to Vehicle Type (Optional)</label>
                <select name="vehicle_id" id="svVehicleType" onchange="updateSvClasses()">
                  <option value="">All Vehicle Types</option>
                  ${vehicleOptionsHtml}
                </select>
              </div>
              <div class="form-group">
                <label>Limit to Class (Optional)</label>
                <select name="class_id" id="svClassSelect">
                  <option value="">All Classes</option>
                </select>
              </div>
              <button type="submit">Add Specialty Vote</button>
            </div>
          </form>

          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Voters</th>
                  <th>Applies To</th>
                  <th>Votes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="6" style="text-align:center;color:#666;">No specialty votes defined yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <script>
          const allSvClasses = ${classesJson};

          function updateSvClasses() {
            const vehicleId = document.getElementById('svVehicleType').value;
            const classSelect = document.getElementById('svClassSelect');
            classSelect.innerHTML = '<option value="">All Classes</option>';
            if (vehicleId) {
              const filtered = allSvClasses.filter(c => c.vehicle_id == vehicleId);
              filtered.forEach(c => {
                classSelect.innerHTML += '<option value="' + c.class_id + '">' + c.class_name + '</option>';
              });
            }
          }

          function confirmDeleteSpecialtyVote(id, name) {
            if (confirm('Are you sure you want to delete the specialty vote "' + name + '"?\\n\\nThis will also remove all voter assignments.\\n\\nThis action cannot be undone.')) {
              window.location.href = '/admin/delete-specialty-vote/' + id;
            }
          }
        </script>
      </body>
      </html>
    `);
  });
    }); // end classes query
  }); // end vehicleTypes query
});

// Add specialty vote
app.post('/admin/add-specialty-vote', requireAdmin, (req, res) => {
  const { vote_name, description, allow_all_users, vehicle_id, class_id } = req.body;
  db.run('INSERT INTO specialty_votes (vote_name, description, allow_all_users, vehicle_id, class_id) VALUES (?, ?, ?, ?, ?)',
    [vote_name, description || null, allow_all_users, vehicle_id || null, class_id || null], (err) => {
    res.redirect('/admin/specialty-votes');
  });
});

// Edit specialty vote page
app.get('/admin/edit-specialty-vote/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const voteId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
    if (err || !vote) {
      res.redirect('/admin/specialty-votes');
      return;
    }

    db.all('SELECT vehicle_id, vehicle_name FROM vehicles WHERE is_active = 1 ORDER BY vehicle_name', (err, vehicleTypes) => {
      if (err) vehicleTypes = [];
      db.all('SELECT class_id, class_name, vehicle_id FROM classes WHERE is_active = 1 ORDER BY class_name', (err, classes) => {
        if (err) classes = [];

        const editVehicleOptions = vehicleTypes.map(v =>
          `<option value="${v.vehicle_id}" ${vote.vehicle_id == v.vehicle_id ? 'selected' : ''}>${v.vehicle_name}</option>`
        ).join('');

        const editClassOptions = vote.vehicle_id
          ? classes.filter(c => c.vehicle_id == vote.vehicle_id).map(c =>
              `<option value="${c.class_id}" ${vote.class_id == c.class_id ? 'selected' : ''}>${c.class_name}</option>`
            ).join('')
          : '';

        const editClassesJson = JSON.stringify(classes);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Specialty Vote - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">Edit Specialty Vote</h3>

          <form method="POST" action="/admin/edit-specialty-vote/${vote.specialty_vote_id}">
            <div class="profile-card">
              <div class="form-group">
                <label>Vote Name</label>
                <input type="text" name="vote_name" required value="${vote.vote_name}">
              </div>
              <div class="form-group">
                <label>Description</label>
                <input type="text" name="description" value="${vote.description || ''}">
              </div>
              <div class="form-group">
                <label>Who Can Vote?</label>
                <select name="allow_all_users">
                  <option value="0" ${!vote.allow_all_users ? 'selected' : ''}>Specific Users Only</option>
                  <option value="1" ${vote.allow_all_users ? 'selected' : ''}>All Users</option>
                </select>
              </div>
              <div class="form-group">
                <label>Limit to Vehicle Type (Optional)</label>
                <select name="vehicle_id" id="editSvVehicleType" onchange="updateEditSvClasses()">
                  <option value="">All Vehicle Types</option>
                  ${editVehicleOptions}
                </select>
              </div>
              <div class="form-group">
                <label>Limit to Class (Optional)</label>
                <select name="class_id" id="editSvClassSelect">
                  <option value="">All Classes</option>
                  ${editClassOptions}
                </select>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="is_active">
                  <option value="1" ${vote.is_active ? 'selected' : ''}>Active</option>
                  <option value="0" ${!vote.is_active ? 'selected' : ''}>Inactive</option>
                </select>
              </div>
              <button type="submit">Update Specialty Vote</button>
            </div>
          </form>

          <div class="links" style="margin-top:20px;">
            <a href="/admin/specialty-votes">Back to Special Vote Config</a>
          </div>
        </div>

        <script>
          const editAllClasses = ${editClassesJson};
          function updateEditSvClasses() {
            const vehicleId = document.getElementById('editSvVehicleType').value;
            const classSelect = document.getElementById('editSvClassSelect');
            classSelect.innerHTML = '<option value="">All Classes</option>';
            if (vehicleId) {
              const filtered = editAllClasses.filter(c => c.vehicle_id == vehicleId);
              filtered.forEach(c => {
                classSelect.innerHTML += '<option value="' + c.class_id + '">' + c.class_name + '</option>';
              });
            }
          }
        </script>
      </body>
      </html>
    `);
      }); // end classes
    }); // end vehicleTypes
  });
});

// Update specialty vote
app.post('/admin/edit-specialty-vote/:id', requireAdmin, (req, res) => {
  const voteId = req.params.id;
  const { vote_name, description, allow_all_users, is_active, vehicle_id, class_id } = req.body;
  db.run('UPDATE specialty_votes SET vote_name = ?, description = ?, allow_all_users = ?, is_active = ?, vehicle_id = ?, class_id = ? WHERE specialty_vote_id = ?',
    [vote_name, description || null, allow_all_users, is_active, vehicle_id || null, class_id || null, voteId], (err) => {
    res.redirect('/admin/specialty-votes');
  });
});

// Delete specialty vote
app.get('/admin/delete-specialty-vote/:id', requireAdmin, (req, res) => {
  const voteId = req.params.id;

  // First delete all vote results
  db.run('DELETE FROM specialty_vote_results WHERE specialty_vote_id = ?', [voteId], (err) => {
    // Then delete all voter assignments
    db.run('DELETE FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err) => {
      // Then delete the specialty vote
      db.run('DELETE FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err) => {
        res.redirect('/admin/specialty-votes');
      });
    });
  });
});

// View specialty vote results
app.get('/admin/specialty-vote-results/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const voteId = req.params.id;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
    if (err || !vote) {
      res.redirect('/admin/specialty-votes');
      return;
    }

    // Get vote tallies grouped by car, ordered by vote count
    db.all(`
      SELECT c.car_id, c.year, c.make, c.model, c.voter_id, c.image_url,
             u.name as owner_name,
             cl.class_name, v.vehicle_name,
             COUNT(svr.id) as vote_count
      FROM specialty_vote_results svr
      JOIN cars c ON svr.car_id = c.car_id
      LEFT JOIN users u ON c.user_id = u.user_id
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      WHERE svr.specialty_vote_id = ?
      GROUP BY c.car_id
      ORDER BY vote_count DESC, c.voter_id
    `, [voteId], (err, results) => {
      if (err) results = [];

      // Get total vote count
      const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);

      // Determine winner(s) - vehicles with highest vote count
      const maxVotes = results.length > 0 ? results[0].vote_count : 0;
      const winners = results.filter(r => r.vote_count === maxVotes && maxVotes > 0);

      const resultRows = results.map((r, index) => {
        const isWinner = r.vote_count === maxVotes && maxVotes > 0;
        const percentage = totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 100) : 0;
        return `
          <tr style="${isWinner ? 'background:#d4edda;' : ''}">
            <td style="font-weight:700;font-size:18px;">${index + 1}</td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                ${r.image_url ? `<img src="${r.image_url}" style="width:60px;height:45px;object-fit:cover;border-radius:6px;">` : ''}
                <div>
                  <div style="font-weight:600;">
                    ${r.voter_id ? `<span style="background:#2c3e50;color:white;padding:2px 6px;border-radius:4px;font-size:11px;margin-right:6px;">#${r.voter_id}</span>` : ''}
                    ${r.year || ''} ${r.make} ${r.model}
                  </div>
                  <div style="font-size:12px;color:#666;">${r.owner_name || 'Unknown'}</div>
                </div>
              </div>
            </td>
            <td>${r.vehicle_name || '-'}</td>
            <td>${r.class_name || '-'}</td>
            <td style="font-weight:700;font-size:16px;">${r.vote_count}</td>
            <td>
              <div style="background:#e1e1e1;border-radius:10px;height:20px;overflow:hidden;">
                <div style="background:${isWinner ? '#27ae60' : '#3498db'};height:100%;width:${percentage}%;"></div>
              </div>
              <span style="font-size:12px;color:#666;">${percentage}%</span>
            </td>
            <td>${isWinner ? '<span style="background:#27ae60;color:white;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;">WINNER</span>' : ''}</td>
          </tr>
        `;
      }).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Results: ${vote.vote_name} - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
          <style>
            .results-header {
              background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
              color: white;
              padding: 20px;
              border-radius: 12px;
              margin-bottom: 20px;
              text-align: center;
            }
            .results-header h2 {
              color: white;
              margin-bottom: 5px;
            }
            .stats-row {
              display: flex;
              gap: 15px;
              margin-bottom: 20px;
              flex-wrap: wrap;
            }
            .stat-card {
              flex: 1;
              min-width: 120px;
              background: #f8f9fa;
              padding: 15px;
              border-radius: 12px;
              text-align: center;
              border: 1px solid #e1e1e1;
            }
            .stat-card .number {
              font-size: 28px;
              font-weight: 700;
              color: #1a1a2e;
            }
            .stat-card .label {
              font-size: 12px;
              color: #666;
              margin-top: 5px;
            }
            .winner-card {
              background: linear-gradient(135deg, #f39c12 0%, #f1c40f 100%);
              color: #1a1a2e;
              padding: 20px;
              border-radius: 12px;
              margin-bottom: 20px;
              text-align: center;
            }
            .winner-card h3 {
              margin-bottom: 10px;
            }
            .winner-card .trophy {
              font-size: 48px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <div class="results-header">
              <h2>Results: ${vote.vote_name}</h2>
              ${vote.description ? `<p>${vote.description}</p>` : ''}
            </div>

            <div class="stats-row">
              <div class="stat-card">
                <div class="number">${totalVotes}</div>
                <div class="label">Total Votes</div>
              </div>
              <div class="stat-card">
                <div class="number">${results.length}</div>
                <div class="label">Vehicles Voted For</div>
              </div>
            </div>

            ${winners.length > 0 ? `
              <div class="winner-card">
                <div class="trophy">🏆</div>
                <h3>${winners.length > 1 ? 'TIE - Winners' : 'Winner'}</h3>
                ${winners.map(w => `
                  <div style="font-size:18px;font-weight:600;">
                    ${w.voter_id ? `#${w.voter_id} - ` : ''}${w.year || ''} ${w.make} ${w.model}
                  </div>
                  <div style="font-size:14px;">Owner: ${w.owner_name || 'Unknown'} | ${w.vote_count} votes</div>
                `).join('<hr style="margin:10px 0;border:none;border-top:1px solid rgba(0,0,0,0.1);">')}
              </div>
            ` : '<p style="text-align:center;color:#666;padding:20px;">No votes have been cast yet.</p>'}

            ${results.length > 0 ? `
              <h3 class="section-title">Full Results</h3>
              <div class="table-wrapper">
                <table class="user-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Vehicle</th>
                      <th>Type</th>
                      <th>Class</th>
                      <th>Votes</th>
                      <th>%</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${resultRows}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <div class="links" style="margin-top:20px;">
              <a href="/admin/specialty-votes">Back to Special Vote Config</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Manage voters for a specialty vote
app.get('/admin/specialty-vote-voters/:id', requireAdmin, (req, res) => {
  const user = req.session.user;
  const voteId = req.params.id;
  const saved = req.query.saved;
  const error = req.query.error;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get('SELECT * FROM specialty_votes WHERE specialty_vote_id = ?', [voteId], (err, vote) => {
    if (err || !vote) {
      res.redirect('/admin/specialty-votes');
      return;
    }

    // Get all users
    db.all('SELECT user_id, username, name, role FROM users WHERE is_active = 1 ORDER BY name', (err, allUsers) => {
      if (err) allUsers = [];

      // Get currently assigned voters
      db.all('SELECT user_id FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err, assignedVoters) => {
        const assignedIds = new Set((assignedVoters || []).map(v => v.user_id));

        const userCheckboxes = allUsers.map(u => `
          <label style="display:flex;align-items:center;gap:8px;padding:8px;background:#f8f9fa;border-radius:8px;margin-bottom:8px;cursor:pointer;">
            <input type="checkbox" name="user_ids" value="${u.user_id}" ${assignedIds.has(u.user_id) ? 'checked' : ''} style="width:18px;height:18px;">
            <span><strong>${u.name}</strong> (${u.username}) - ${u.role}</span>
          </label>
        `).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Voters: ${vote.vote_name} - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
          </head>
          <body>
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Admin Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/admin/app-config">App Config</a>
                <a href="/admin/vehicle-config">Vehicle Config</a>
                <a href="/admin/categories">Judge Config</a>
                <a href="/admin/specialty-votes">Special Vote Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Cars</a>
                <a href="/admin/judge-status">Judge Status</a>
                <a href="/admin/vote-status">Vote Status</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/profile">Profile</a>
              </div>

              <h3 class="section-title">Voters: ${vote.vote_name}</h3>
              ${saved ? '<div class="success-message" style="margin-bottom:15px;">Voter assignments saved successfully!</div>' : ''}
              ${error ? '<div style="background:#f8d7da;color:#721c24;padding:12px;border-radius:8px;margin-bottom:15px;font-weight:600;">Failed to save voter assignments. Please try again.</div>' : ''}
              ${vote.allow_all_users
                ? `<div class="profile-card">
                    <div style="background:#d4edda;color:#155724;padding:16px;border-radius:8px;text-align:center;">
                      <strong>All Users</strong><br>
                      <span style="font-size:14px;">This vote is configured to allow all users to participate. No individual voter assignments are needed.</span>
                    </div>
                  </div>`
                : `<form method="POST" action="/admin/update-specialty-vote-voters/${vote.specialty_vote_id}" id="voterForm">
                <div class="profile-card">
                  <p style="color:#666;margin-bottom:15px;">Select which users can participate in this vote.</p>
                  <div style="display:flex;gap:10px;margin-bottom:15px;">
                    <button type="button" onclick="selectAll()" style="flex:1;">Select All</button>
                    <button type="button" onclick="selectNone()" style="flex:1;background:#6c757d;">Select None</button>
                  </div>

                  <div style="max-height:400px;overflow-y:auto;">
                    ${userCheckboxes || '<p style="color:#666;">No users found.</p>'}
                  </div>

                  <button type="submit" style="margin-top:15px;">Save Voter Assignments</button>
                  <div id="saveMessage" style="display:none;margin-top:10px;padding:10px;border-radius:8px;text-align:center;font-weight:600;"></div>
                </div>
              </form>`
              }

              <div class="links" style="margin-top:20px;">
                <a href="/admin/specialty-votes">Back to Special Vote Config</a>
              </div>
            </div>

            <script>
              function selectAll() {
                document.querySelectorAll('input[name="user_ids"]').forEach(cb => cb.checked = true);
              }
              function selectNone() {
                document.querySelectorAll('input[name="user_ids"]').forEach(cb => cb.checked = false);
              }
            </script>
          </body>
          </html>
        `);
      });
    });
  });
});

// Update voter assignments for a specialty vote
app.post('/admin/update-specialty-vote-voters/:id', requireAdmin, (req, res) => {
  const voteId = req.params.id;
  let userIds = req.body.user_ids || [];

  // Ensure userIds is an array
  if (!Array.isArray(userIds)) {
    userIds = userIds ? [userIds] : [];
  }

  // First delete all existing assignments
  db.run('DELETE FROM specialty_vote_voters WHERE specialty_vote_id = ?', [voteId], (err) => {
    if (err) {
      res.redirect(`/admin/specialty-vote-voters/${voteId}?error=1`);
      return;
    }

    if (userIds.length === 0) {
      res.redirect(`/admin/specialty-vote-voters/${voteId}?saved=1`);
      return;
    }

    // Insert new assignments
    const placeholders = userIds.map(() => '(?, ?)').join(', ');
    const values = [];
    userIds.forEach(userId => {
      values.push(voteId, userId);
    });

    db.run(`INSERT INTO specialty_vote_voters (specialty_vote_id, user_id) VALUES ${placeholders}`, values, (err) => {
      if (err) {
        res.redirect(`/admin/specialty-vote-voters/${voteId}?error=1`);
      } else {
        res.redirect(`/admin/specialty-vote-voters/${voteId}?saved=1`);
      }
    });
  });
});

// Admin Judge Status page - shows judge scores and allows management
app.get('/admin/judge-status', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all judges
  db.all(`SELECT user_id, name FROM users WHERE role = 'judge' AND is_active = 1 ORDER BY name`, (err, judges) => {
    if (err) judges = [];

    // Get all cars with their classes
    db.all(`
      SELECT c.car_id, c.year, c.make, c.model, c.voter_id,
             cl.class_name, cl.class_id, v.vehicle_name
      FROM cars c
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      WHERE c.is_active = 1
      ORDER BY cl.class_name, c.make, c.model
    `, (err, cars) => {
      if (err) cars = [];

      // Get all judge scores
      db.all(`
        SELECT js.*, u.name as judge_name, jq.question, jq.max_score
        FROM judge_scores js
        JOIN users u ON js.judge_id = u.user_id
        JOIN judge_questions jq ON js.question_id = jq.judge_question_id
        ORDER BY js.car_id, u.name
      `, (err, scores) => {
        if (err) scores = [];

        // Calculate total scores per car per judge
        const carScores = {};
        scores.forEach(s => {
          const key = `${s.car_id}-${s.judge_id}`;
          if (!carScores[key]) {
            carScores[key] = { judge_name: s.judge_name, judge_id: s.judge_id, car_id: s.car_id, total: 0, count: 0 };
          }
          carScores[key].total += s.score;
          carScores[key].count++;
        });

        // Build rows for each car
        const carRows = cars.map(car => {
          const carJudgeScores = Object.values(carScores).filter(cs => cs.car_id === car.car_id);
          const totalScore = carJudgeScores.reduce((sum, cs) => sum + cs.total, 0);
          const avgScore = carJudgeScores.length > 0 ? (totalScore / carJudgeScores.length).toFixed(1) : '-';

          const judgeDetails = carJudgeScores.map(cs =>
            `<span style="background:#3498db;color:white;padding:2px 8px;border-radius:10px;font-size:11px;margin:2px;">${cs.judge_name}: ${cs.total}</span>`
          ).join(' ');

          return `
            <tr>
              <td>${car.voter_id || '-'}</td>
              <td>${car.year || ''} ${car.make} ${car.model}</td>
              <td>${car.class_name || 'Unassigned'}</td>
              <td>${judgeDetails || '<span style="color:#999;">No scores yet</span>'}</td>
              <td><strong>${avgScore}</strong></td>
              <td>
                <a href="/admin/edit-judge-scores/${car.car_id}" class="action-btn edit">Edit Scores</a>
              </td>
            </tr>
          `;
        }).join('');

        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Judge Status - Admin</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            ${styles}
            ${adminStyles}
          </head>
          <body>
            <div class="container dashboard-container">
              <div class="dashboard-header">
                <h1>🏎️ Admin Dashboard</h1>
                <div class="user-info">
                  <div class="user-avatar">${avatarContent}</div>
                  <a href="/logout" class="logout-btn">Sign Out</a>
                </div>
              </div>

              <div class="admin-nav">
                <a href="/admin/app-config">App Config</a>
                <a href="/admin/vehicle-config">Vehicle Config</a>
                <a href="/admin/categories">Judge Config</a>
                <a href="/admin/specialty-votes">Special Vote Config</a>
                <a href="/admin">Users</a>
                <a href="/admin/vehicles">Cars</a>
                <a href="/admin/judge-status" class="active">Judge Status</a>
                <a href="/admin/vote-status">Vote Status</a>
                <a href="/admin/reports">Reports</a>
                <a href="/admin/profile">Profile</a>
              </div>

              <h3 class="section-title">Judge Voting Status</h3>

              <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <span style="padding: 8px 16px; border-radius: 20px; font-weight: 600; ${appConfig.judgeVotingLocked ? 'background:#e74c3c;color:white;' : 'background:#27ae60;color:white;'}">
                  ${appConfig.judgeVotingLocked ? '🔒 Voting LOCKED' : '🔓 Voting OPEN'}
                </span>
                <a href="/admin/preview-judge-results" class="action-btn" style="background:#3498db;">Preview Results</a>
                ${appConfig.judgeVotingLocked
                  ? `<a href="/admin/unlock-judge-voting" class="action-btn" style="background:#27ae60;" onclick="return confirm('Unlock voting? Judges will be able to vote again.')">Unlock Voting</a>`
                  : `<a href="/admin/lock-judge-voting" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Lock voting and publish results? Judges will no longer be able to vote.')">Lock & Publish Results</a>`
                }
              </div>

              <div style="overflow-x: auto;">
                <table class="data-table" style="min-width: 700px;">
                  <thead>
                    <tr>
                      <th>Voter ID</th>
                      <th>Vehicle</th>
                      <th>Class</th>
                      <th>Judge Scores</th>
                      <th>Avg Score</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${carRows || '<tr><td colspan="6" style="text-align:center;color:#999;">No cars registered</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </body>
          </html>
        `);
      });
    });
  });
});

// Edit judge scores for a specific car
app.get('/admin/edit-judge-scores/:carId', requireAdmin, (req, res) => {
  const carId = req.params.carId;
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get car details
  db.get(`
    SELECT c.*, cl.class_name, v.vehicle_id, v.vehicle_name
    FROM cars c
    LEFT JOIN classes cl ON c.class_id = cl.class_id
    LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
    WHERE c.car_id = ?
  `, [carId], (err, car) => {
    if (err || !car) {
      res.redirect('/admin/judge-status');
      return;
    }

    // Get all judges
    db.all(`SELECT user_id, name FROM users WHERE role = 'judge' AND is_active = 1 ORDER BY name`, (err, judges) => {
      if (err) judges = [];

      // Get all questions for this vehicle type
      db.all(`
        SELECT jq.*, jc.catagory_name
        FROM judge_questions jq
        JOIN judge_catagories jc ON jq.judge_catagory_id = jc.judge_catagory_id
        WHERE jq.vehicle_id = ? AND jq.is_active = 1
        ORDER BY jc.display_order, jq.display_order
      `, [car.vehicle_id], (err, questions) => {
        if (err) questions = [];

        // Get existing scores for this car
        db.all(`
          SELECT js.*, u.name as judge_name
          FROM judge_scores js
          JOIN users u ON js.judge_id = u.user_id
          WHERE js.car_id = ?
        `, [carId], (err, scores) => {
          if (err) scores = [];

          // Create a map of scores
          const scoreMap = {};
          scores.forEach(s => {
            scoreMap[`${s.judge_id}-${s.question_id}`] = s.score;
          });

          // Build form rows for each judge
          const judgeRows = judges.map(judge => {
            const questionInputs = questions.map(q => {
              const key = `${judge.user_id}-${q.judge_question_id}`;
              const currentScore = scoreMap[key] !== undefined ? scoreMap[key] : '';
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:#f8f9fa;border-radius:4px;margin-bottom:5px;">
                  <span style="flex:1;font-size:13px;">${q.question} (${q.min_score}-${q.max_score})</span>
                  <input type="number" name="score_${judge.user_id}_${q.judge_question_id}"
                         value="${currentScore}" min="${q.min_score}" max="${q.max_score}"
                         style="width:60px;padding:5px;border:1px solid #ddd;border-radius:4px;">
                </div>
              `;
            }).join('');

            return `
              <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:15px;margin-bottom:15px;">
                <h4 style="margin:0 0 10px 0;color:#2c3e50;">${judge.name}</h4>
                ${questionInputs || '<p style="color:#999;">No questions configured for this vehicle type</p>'}
              </div>
            `;
          }).join('');

          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Edit Scores - Admin</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
              ${styles}
              ${adminStyles}
            </head>
            <body>
              <div class="container dashboard-container">
                <div class="dashboard-header">
                  <h1>🏎️ Admin Dashboard</h1>
                  <div class="user-info">
                    <div class="user-avatar">${avatarContent}</div>
                    <a href="/logout" class="logout-btn">Sign Out</a>
                  </div>
                </div>

                <div class="admin-nav">
                  <a href="/admin/app-config">App Config</a>
                  <a href="/admin/vehicle-config">Vehicle Config</a>
                  <a href="/admin/categories">Judge Config</a>
                  <a href="/admin/specialty-votes">Special Vote Config</a>
                  <a href="/admin">Users</a>
                  <a href="/admin/vehicles">Cars</a>
                  <a href="/admin/judge-status" class="active">Judge Status</a>
                  <a href="/admin/vote-status">Vote Status</a>
                  <a href="/admin/reports">Reports</a>
                  <a href="/admin/profile">Profile</a>
                </div>

                <h3 class="section-title">Edit Scores: ${car.year || ''} ${car.make} ${car.model}</h3>
                <p style="color:#666;margin-bottom:20px;">Class: ${car.class_name || 'Unassigned'} | Voter ID: ${car.voter_id || 'N/A'}</p>

                <form method="POST" action="/admin/save-judge-scores/${carId}">
                  ${judgeRows || '<p>No judges available</p>'}
                  <div style="margin-top:20px;">
                    <button type="submit" style="background:#27ae60;color:white;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Save All Scores</button>
                    <a href="/admin/judge-status" style="margin-left:10px;color:#666;">Cancel</a>
                  </div>
                </form>
              </div>
            </body>
            </html>
          `);
        });
      });
    });
  });
});

// Save judge scores
app.post('/admin/save-judge-scores/:carId', requireAdmin, (req, res) => {
  const carId = req.params.carId;
  const body = req.body;

  // Extract all scores from form
  const scoreUpdates = [];
  for (const key in body) {
    if (key.startsWith('score_')) {
      const parts = key.split('_');
      const judgeId = parts[1];
      const questionId = parts[2];
      const score = body[key];
      if (score !== '') {
        scoreUpdates.push({ judgeId, questionId, score: parseInt(score) });
      }
    }
  }

  // Delete existing scores for this car and re-insert
  db.run('DELETE FROM judge_scores WHERE car_id = ?', [carId], (err) => {
    if (scoreUpdates.length === 0) {
      res.redirect('/admin/judge-status');
      return;
    }

    const placeholders = scoreUpdates.map(() => '(?, ?, ?, ?)').join(', ');
    const values = [];
    scoreUpdates.forEach(su => {
      values.push(su.judgeId, carId, su.questionId, su.score);
    });

    db.run(`INSERT INTO judge_scores (judge_id, car_id, question_id, score) VALUES ${placeholders}`, values, (err) => {
      res.redirect('/admin/judge-status');
    });
  });
});

// Preview judge results
app.get('/admin/preview-judge-results', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all classes
  db.all(`SELECT * FROM classes WHERE is_active = 1 ORDER BY class_name`, (err, classes) => {
    if (err) classes = [];

    // Get all cars with scores
    db.all(`
      SELECT c.car_id, c.year, c.make, c.model, c.voter_id, c.class_id,
             cl.class_name,
             SUM(js.score) as total_score,
             COUNT(DISTINCT js.judge_id) as judge_count
      FROM cars c
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      LEFT JOIN judge_scores js ON c.car_id = js.car_id
      WHERE c.is_active = 1
      GROUP BY c.car_id
      ORDER BY c.class_id, total_score DESC
    `, (err, cars) => {
      if (err) cars = [];

      // Group by class and get top 3
      const resultsByClass = {};
      classes.forEach(cl => {
        resultsByClass[cl.class_id] = {
          class_name: cl.class_name,
          cars: []
        };
      });

      cars.forEach(car => {
        if (car.class_id && resultsByClass[car.class_id]) {
          resultsByClass[car.class_id].cars.push(car);
        }
      });

      // Build results HTML
      const classResults = Object.values(resultsByClass).map(classData => {
        const top3 = classData.cars.slice(0, 3);
        const placeLabels = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];

        const carsList = top3.map((car, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:${idx === 0 ? '#fff9e6' : '#f8f9fa'};border-radius:6px;margin-bottom:8px;border:${idx === 0 ? '2px solid #f1c40f' : '1px solid #ddd'};">
            <span><strong>${placeLabels[idx]}</strong> - ${car.year || ''} ${car.make} ${car.model} (ID: ${car.voter_id || 'N/A'})</span>
            <span style="background:#27ae60;color:white;padding:4px 12px;border-radius:20px;font-weight:600;">${car.total_score || 0} pts</span>
          </div>
        `).join('');

        return `
          <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:20px;">
            <h4 style="margin:0 0 15px 0;color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:10px;">${classData.class_name}</h4>
            ${carsList || '<p style="color:#999;">No scored vehicles in this class</p>'}
          </div>
        `;
      }).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview Results - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status" class="active">Judge Status</a>
              <a href="/admin/vote-status">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">Preview Judge Results - Top 3 by Class</h3>
            <p style="color:#666;margin-bottom:20px;">This is a preview. Results are not yet published.</p>

            ${classResults || '<p>No classes configured</p>'}

            <div style="margin-top:20px;">
              <a href="/admin/judge-status" class="action-btn" style="background:#666;">Back to Judge Status</a>
              ${!appConfig.judgeVotingLocked
                ? `<a href="/admin/lock-judge-voting" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Lock voting and publish these results?')">Lock & Publish Results</a>`
                : ''
              }
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Lock judge voting and publish results
app.get('/admin/lock-judge-voting', requireAdmin, (req, res) => {
  appConfig.judgeVotingLocked = true;
  saveConfig();

  // Clear any existing published judge results
  db.run(`DELETE FROM published_results WHERE result_type = 'judge'`, (err) => {
    // Get all classes
    db.all(`SELECT * FROM classes WHERE is_active = 1`, (err, classes) => {
      if (err || !classes || classes.length === 0) {
        res.redirect('/admin/judge-status');
        return;
      }

      // Get all cars with scores grouped by class
      db.all(`
        SELECT c.car_id, c.class_id,
               SUM(js.score) as total_score
        FROM cars c
        LEFT JOIN judge_scores js ON c.car_id = js.car_id
        WHERE c.is_active = 1 AND c.class_id IS NOT NULL
        GROUP BY c.car_id
        ORDER BY c.class_id, total_score DESC
      `, (err, cars) => {
        if (err) cars = [];

        // Group by class and insert top 3
        const insertValues = [];
        const resultsByClass = {};

        cars.forEach(car => {
          if (!resultsByClass[car.class_id]) {
            resultsByClass[car.class_id] = [];
          }
          if (resultsByClass[car.class_id].length < 3) {
            resultsByClass[car.class_id].push(car);
          }
        });

        Object.keys(resultsByClass).forEach(classId => {
          resultsByClass[classId].forEach((car, idx) => {
            insertValues.push('judge', classId, car.car_id, idx + 1, car.total_score || 0);
          });
        });

        if (insertValues.length === 0) {
          res.redirect('/admin/judge-status');
          return;
        }

        const placeholders = [];
        for (let i = 0; i < insertValues.length; i += 5) {
          placeholders.push('(?, ?, ?, ?, ?)');
        }

        db.run(`INSERT INTO published_results (result_type, class_id, car_id, place, total_score) VALUES ${placeholders.join(', ')}`, insertValues, (err) => {
          res.redirect('/admin/judge-status');
        });
      });
    });
  });
});

// Unlock judge voting
app.get('/admin/unlock-judge-voting', requireAdmin, (req, res) => {
  appConfig.judgeVotingLocked = false;
  saveConfig();
  res.redirect('/admin/judge-status');
});

// Admin Vote Status page - shows specialty vote status
app.get('/admin/vote-status', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all specialty votes with their results
  db.all(`
    SELECT sv.*,
           (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as total_votes
    FROM specialty_votes sv
    WHERE sv.is_active = 1
    ORDER BY sv.vote_name
  `, (err, specialtyVotes) => {
    if (err) specialtyVotes = [];

    // Get vote counts per car for each specialty vote
    db.all(`
      SELECT svr.specialty_vote_id, svr.car_id,
             c.year, c.make, c.model, c.voter_id,
             COUNT(*) as vote_count
      FROM specialty_vote_results svr
      JOIN cars c ON svr.car_id = c.car_id
      GROUP BY svr.specialty_vote_id, svr.car_id
      ORDER BY svr.specialty_vote_id, vote_count DESC
    `, (err, voteResults) => {
      if (err) voteResults = [];

      // Build results by specialty vote
      const resultsByVote = {};
      voteResults.forEach(vr => {
        if (!resultsByVote[vr.specialty_vote_id]) {
          resultsByVote[vr.specialty_vote_id] = [];
        }
        resultsByVote[vr.specialty_vote_id].push(vr);
      });

      const voteRows = specialtyVotes.map(sv => {
        const results = resultsByVote[sv.specialty_vote_id] || [];
        const topCar = results[0];
        const leaderInfo = topCar
          ? `${topCar.year || ''} ${topCar.make} ${topCar.model} (${topCar.vote_count} votes)`
          : 'No votes yet';

        return `
          <tr>
            <td><strong>${sv.vote_name}</strong></td>
            <td>${sv.description || '-'}</td>
            <td><span style="background:#27ae60;color:white;padding:4px 12px;border-radius:20px;font-weight:600;">${sv.total_votes}</span></td>
            <td>${leaderInfo}</td>
            <td>
              <a href="/admin/edit-vote-results/${sv.specialty_vote_id}" class="action-btn edit">View/Edit</a>
            </td>
          </tr>
        `;
      }).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vote Status - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status" class="active">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">Specialty Vote Status</h3>

            <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
              <span style="padding: 8px 16px; border-radius: 20px; font-weight: 600; ${appConfig.specialtyVotingLocked ? 'background:#e74c3c;color:white;' : 'background:#27ae60;color:white;'}">
                ${appConfig.specialtyVotingLocked ? '🔒 Voting LOCKED' : '🔓 Voting OPEN'}
              </span>
              <a href="/admin/preview-vote-results" class="action-btn" style="background:#3498db;">Preview Results</a>
              ${appConfig.specialtyVotingLocked
                ? `<a href="/admin/unlock-specialty-voting" class="action-btn" style="background:#27ae60;" onclick="return confirm('Unlock voting? Users will be able to vote again.')">Unlock Voting</a>`
                : `<a href="/admin/lock-specialty-voting" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Lock voting and publish results? Users will no longer be able to vote.')">Lock & Publish Results</a>`
              }
            </div>

            <div style="overflow-x: auto;">
              <table class="data-table" style="min-width: 600px;">
                <thead>
                  <tr>
                    <th>Vote Name</th>
                    <th>Description</th>
                    <th>Total Votes</th>
                    <th>Current Leader</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${voteRows || '<tr><td colspan="5" style="text-align:center;color:#999;">No specialty votes configured</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// View/Edit specialty vote results
app.get('/admin/edit-vote-results/:voteId', requireAdmin, (req, res) => {
  const voteId = req.params.voteId;
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  db.get(`SELECT * FROM specialty_votes WHERE specialty_vote_id = ?`, [voteId], (err, vote) => {
    if (err || !vote) {
      res.redirect('/admin/vote-status');
      return;
    }

    // Get all votes with voter info
    db.all(`
      SELECT svr.*, u.name as voter_name, c.year, c.make, c.model, c.voter_id as car_voter_id
      FROM specialty_vote_results svr
      JOIN users u ON svr.user_id = u.user_id
      JOIN cars c ON svr.car_id = c.car_id
      WHERE svr.specialty_vote_id = ?
      ORDER BY svr.voted_at DESC
    `, [voteId], (err, results) => {
      if (err) results = [];

      const resultRows = results.map(r => `
        <tr>
          <td>${r.voter_name}</td>
          <td>${r.year || ''} ${r.make} ${r.model} (ID: ${r.car_voter_id || 'N/A'})</td>
          <td>${new Date(r.voted_at).toLocaleString()}</td>
          <td>
            <a href="/admin/delete-vote-result/${r.id}?voteId=${voteId}" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Delete this vote?')">Delete</a>
          </td>
        </tr>
      `).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vote Results - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status" class="active">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">${vote.vote_name} - All Votes</h3>
            <p style="color:#666;margin-bottom:20px;">Total votes: ${results.length}</p>

            <div style="overflow-x: auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Voter</th>
                    <th>Voted For</th>
                    <th>Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${resultRows || '<tr><td colspan="4" style="text-align:center;color:#999;">No votes cast</td></tr>'}
                </tbody>
              </table>
            </div>

            <div style="margin-top:20px;">
              <a href="/admin/vote-status" class="action-btn" style="background:#666;">Back to Vote Status</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Delete a specialty vote result
app.get('/admin/delete-vote-result/:id', requireAdmin, (req, res) => {
  const resultId = req.params.id;
  const voteId = req.query.voteId;

  db.run(`DELETE FROM specialty_vote_results WHERE id = ?`, [resultId], (err) => {
    res.redirect(`/admin/edit-vote-results/${voteId}`);
  });
});

// Preview specialty vote results
app.get('/admin/preview-vote-results', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Get all specialty votes
  db.all(`SELECT * FROM specialty_votes WHERE is_active = 1 ORDER BY vote_name`, (err, specialtyVotes) => {
    if (err) specialtyVotes = [];

    // Get vote counts per car for each specialty vote
    db.all(`
      SELECT svr.specialty_vote_id, svr.car_id,
             c.year, c.make, c.model, c.voter_id,
             COUNT(*) as vote_count
      FROM specialty_vote_results svr
      JOIN cars c ON svr.car_id = c.car_id
      GROUP BY svr.specialty_vote_id, svr.car_id
      ORDER BY svr.specialty_vote_id, vote_count DESC
    `, (err, voteResults) => {
      if (err) voteResults = [];

      // Build results by specialty vote
      const resultsByVote = {};
      voteResults.forEach(vr => {
        if (!resultsByVote[vr.specialty_vote_id]) {
          resultsByVote[vr.specialty_vote_id] = [];
        }
        resultsByVote[vr.specialty_vote_id].push(vr);
      });

      const voteCards = specialtyVotes.map(sv => {
        const results = resultsByVote[sv.specialty_vote_id] || [];
        const winner = results[0];

        const winnerDisplay = winner
          ? `
            <div style="background:#fff9e6;border:2px solid #f1c40f;border-radius:8px;padding:15px;text-align:center;">
              <div style="font-size:36px;margin-bottom:10px;">🏆</div>
              <div style="font-size:18px;font-weight:bold;color:#2c3e50;">${winner.year || ''} ${winner.make} ${winner.model}</div>
              <div style="color:#666;margin-top:5px;">Voter ID: ${winner.voter_id || 'N/A'}</div>
              <div style="margin-top:10px;background:#27ae60;color:white;padding:6px 16px;border-radius:20px;display:inline-block;font-weight:600;">${winner.vote_count} votes</div>
            </div>
          `
          : '<p style="color:#999;text-align:center;">No votes cast yet</p>';

        return `
          <div style="background:white;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:20px;">
            <h4 style="margin:0 0 15px 0;color:#2c3e50;border-bottom:2px solid #9b59b6;padding-bottom:10px;">${sv.vote_name}</h4>
            ${winnerDisplay}
          </div>
        `;
      }).join('');

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Preview Vote Results - Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          ${styles}
          ${adminStyles}
        </head>
        <body>
          <div class="container dashboard-container">
            <div class="dashboard-header">
              <h1>🏎️ Admin Dashboard</h1>
              <div class="user-info">
                <div class="user-avatar">${avatarContent}</div>
                <a href="/logout" class="logout-btn">Sign Out</a>
              </div>
            </div>

            <div class="admin-nav">
              <a href="/admin/app-config">App Config</a>
              <a href="/admin/vehicle-config">Vehicle Config</a>
              <a href="/admin/categories">Judge Config</a>
              <a href="/admin/specialty-votes">Special Vote Config</a>
              <a href="/admin">Users</a>
              <a href="/admin/vehicles">Cars</a>
              <a href="/admin/judge-status">Judge Status</a>
              <a href="/admin/vote-status" class="active">Vote Status</a>
              <a href="/admin/reports">Reports</a>
              <a href="/admin/profile">Profile</a>
            </div>

            <h3 class="section-title">Preview Specialty Vote Winners</h3>
            <p style="color:#666;margin-bottom:20px;">This is a preview. Results are not yet published.</p>

            ${voteCards || '<p>No specialty votes configured</p>'}

            <div style="margin-top:20px;">
              <a href="/admin/vote-status" class="action-btn" style="background:#666;">Back to Vote Status</a>
              ${!appConfig.specialtyVotingLocked
                ? `<a href="/admin/lock-specialty-voting" class="action-btn" style="background:#e74c3c;" onclick="return confirm('Lock voting and publish these results?')">Lock & Publish Results</a>`
                : ''
              }
            </div>
          </div>
        </body>
        </html>
      `);
    });
  });
});

// Lock specialty voting and publish results
app.get('/admin/lock-specialty-voting', requireAdmin, (req, res) => {
  appConfig.specialtyVotingLocked = true;
  saveConfig();

  // Clear any existing published specialty results
  db.run(`DELETE FROM published_results WHERE result_type = 'specialty'`, (err) => {
    // Get winners for each specialty vote
    db.all(`
      SELECT svr.specialty_vote_id, svr.car_id, COUNT(*) as vote_count
      FROM specialty_vote_results svr
      GROUP BY svr.specialty_vote_id, svr.car_id
      ORDER BY svr.specialty_vote_id, vote_count DESC
    `, (err, results) => {
      if (err) results = [];

      // Get top winner for each specialty vote
      const winners = {};
      results.forEach(r => {
        if (!winners[r.specialty_vote_id]) {
          winners[r.specialty_vote_id] = r;
        }
      });

      const insertValues = [];
      Object.keys(winners).forEach(voteId => {
        const w = winners[voteId];
        insertValues.push('specialty', voteId, w.car_id, 1, w.vote_count);
      });

      if (insertValues.length === 0) {
        res.redirect('/admin/vote-status');
        return;
      }

      const placeholders = [];
      for (let i = 0; i < insertValues.length; i += 5) {
        placeholders.push('(?, ?, ?, ?, ?)');
      }

      db.run(`INSERT INTO published_results (result_type, specialty_vote_id, car_id, place, total_score) VALUES ${placeholders.join(', ')}`, insertValues, (err) => {
        res.redirect('/admin/vote-status');
      });
    });
  });
});

// Unlock specialty voting
app.get('/admin/unlock-specialty-voting', requireAdmin, (req, res) => {
  appConfig.specialtyVotingLocked = false;
  saveConfig();
  res.redirect('/admin/vote-status');
});

// Admin App Config page
app.get('/admin/app-config', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  const saved = req.query.saved === '1';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>App Config - Admin</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      ${styles}
      ${adminStyles}
    </head>
    <body>
      <div class="container dashboard-container">
        <div class="dashboard-header">
          <h1>🏎️ Admin Dashboard</h1>
          <div class="user-info">
            <div class="user-avatar">${avatarContent}</div>
            <a href="/logout" class="logout-btn">Sign Out</a>
          </div>
        </div>

        <div class="admin-nav">
          <a href="/admin/app-config" class="active">App Config</a>
          <a href="/admin/vehicle-config">Vehicle Config</a>
          <a href="/admin/categories">Judge Config</a>
          <a href="/admin/specialty-votes">Special Vote Config</a>
          <a href="/admin">Users</a>
          <a href="/admin/vehicles">Cars</a>
          <a href="/admin/judge-status">Judge Status</a>
          <a href="/admin/vote-status">Vote Status</a>
          <a href="/admin/reports">Reports</a>
          <a href="/admin/profile">Profile</a>
        </div>

        <h3 class="section-title">Application Configuration</h3>

        ${saved ? '<div class="success-message" style="max-width: 600px; margin-bottom: 20px;">Configuration saved successfully!</div>' : ''}

        <form method="POST" action="/admin/app-config" style="max-width: 600px;">
          <div class="form-group">
            <label>Application Title</label>
            <input type="text" name="appTitle" value="${appConfig.appTitle || ''}" required placeholder="Enter application title">
            <small style="color: #666; display: block; margin-top: 5px;">This appears on the login page</small>
          </div>
          <div class="form-group">
            <label>Login Subtitle</label>
            <input type="text" name="appSubtitle" value="${appConfig.appSubtitle || ''}" placeholder="Enter subtitle (optional)">
            <small style="color: #666; display: block; margin-top: 5px;">Appears below the title on the login page</small>
          </div>
          <button type="submit" style="background: #27ae60; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px;">Save Configuration</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Save App Config
app.post('/admin/app-config', requireAdmin, (req, res) => {
  const { appTitle, appSubtitle } = req.body;

  appConfig.appTitle = appTitle || 'Car Show Manager';
  appConfig.appSubtitle = appSubtitle || '';

  saveConfig();

  res.redirect('/admin/app-config?saved=1');
});

// ============================================================================
// ADMIN REPORTS
// ============================================================================

// Reports page
app.get('/admin/reports', requireAdmin, (req, res) => {
  const user = req.session.user;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  // Gather counts for each report
  db.get('SELECT COUNT(*) as cnt FROM users', (err, userCount) => {
    db.get('SELECT COUNT(*) as cnt FROM cars', (err, carCount) => {
      db.get('SELECT COUNT(*) as cnt FROM classes', (err, classCount) => {
        db.get('SELECT COUNT(*) as cnt FROM specialty_votes', (err, svCount) => {
          db.get('SELECT COUNT(*) as cnt FROM judge_catagories', (err, catCount) => {

            const reports = [
              {
                id: 'users',
                title: 'Users & Contact Information',
                description: 'List of all users with their name, username, email, phone, role, and account status.',
                count: (userCount ? userCount.cnt : 0) + ' users'
              },
              {
                id: 'vehicles-winners',
                title: 'Registered Vehicles with Winners',
                description: 'All registered vehicles with owner info and any places won in judging or specialty votes.',
                count: (carCount ? carCount.cnt : 0) + ' vehicles'
              },
              {
                id: 'vehicles-classes',
                title: 'Vehicles by Class',
                description: 'All vehicles grouped with their assigned vehicle type and competition class.',
                count: (classCount ? classCount.cnt : 0) + ' classes'
              },
              {
                id: 'specialty-votes',
                title: 'Specialty Votes',
                description: 'All specialty vote categories with their configuration, voter counts, and vote tallies.',
                count: (svCount ? svCount.cnt : 0) + ' votes'
              },
              {
                id: 'judging-config',
                title: 'Judging Categories, Questions & Scoring',
                description: 'Complete judging configuration including categories, questions, and score ranges.',
                count: (catCount ? catCount.cnt : 0) + ' categories'
              }
            ];

            const reportCards = reports.map(r => `
              <div class="profile-card" style="margin-bottom:15px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
                  <div style="flex:1;min-width:200px;">
                    <h4 style="margin:0 0 5px 0;">${r.title}</h4>
                    <p style="color:#666;margin:0 0 8px 0;font-size:14px;">${r.description}</p>
                    <span style="background:#3498db;color:white;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">${r.count}</span>
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <a href="/admin/reports/view/${r.id}" class="action-btn" style="background:#27ae60;">View</a>
                    <a href="/admin/reports/export/${r.id}" class="action-btn" style="background:#3498db;">Export CSV</a>
                  </div>
                </div>
              </div>
            `).join('');

            res.send(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Reports - Admin</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                ${styles}
                ${adminStyles}
              </head>
              <body>
                <div class="container dashboard-container">
                  <div class="dashboard-header">
                    <h1>🏎️ Admin Dashboard</h1>
                    <div class="user-info">
                      <div class="user-avatar">${avatarContent}</div>
                      <a href="/logout" class="logout-btn">Sign Out</a>
                    </div>
                  </div>

                  <div class="admin-nav">
                    <a href="/admin/app-config">App Config</a>
                    <a href="/admin/vehicle-config">Vehicle Config</a>
                    <a href="/admin/categories">Judge Config</a>
                    <a href="/admin/specialty-votes">Special Vote Config</a>
                    <a href="/admin">Users</a>
                    <a href="/admin/vehicles">Cars</a>
                    <a href="/admin/judge-status">Judge Status</a>
                    <a href="/admin/vote-status">Vote Status</a>
                    <a href="/admin/reports" class="active">Reports</a>
                    <a href="/admin/profile">Profile</a>
                  </div>

                  <h3 class="section-title">Reports</h3>
                  <p style="color:#666;margin-bottom:15px;">View and export reports as CSV files.</p>

                  ${reportCards}
                </div>
              </body>
              </html>
            `);
          });
        });
      });
    });
  });
});

// View report
app.get('/admin/reports/view/:reportId', requireAdmin, (req, res) => {
  const user = req.session.user;
  const reportId = req.params.reportId;
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const avatarContent = user.image_url
    ? `<img src="${user.image_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : initials;

  const renderReport = (title, headers, rows, colSpan) => {
    const headerHtml = headers.map(h => `<th>${h}</th>`).join('');
    const rowHtml = rows.length > 0
      ? rows.join('')
      : `<tr><td colspan="${colSpan}" style="text-align:center;color:#666;">No data found.</td></tr>`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - Reports - Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        ${styles}
        ${adminStyles}
      </head>
      <body>
        <div class="container dashboard-container">
          <div class="dashboard-header">
            <h1>🏎️ Admin Dashboard</h1>
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <a href="/logout" class="logout-btn">Sign Out</a>
            </div>
          </div>

          <div class="admin-nav">
            <a href="/admin/app-config">App Config</a>
            <a href="/admin/vehicle-config">Vehicle Config</a>
            <a href="/admin/categories">Judge Config</a>
            <a href="/admin/specialty-votes">Special Vote Config</a>
            <a href="/admin">Users</a>
            <a href="/admin/vehicles">Cars</a>
            <a href="/admin/judge-status">Judge Status</a>
            <a href="/admin/vote-status">Vote Status</a>
            <a href="/admin/reports" class="active">Reports</a>
            <a href="/admin/profile">Profile</a>
          </div>

          <h3 class="section-title">${title}</h3>
          <div style="margin-bottom:15px;">
            <a href="/admin/reports/export/${reportId}" class="action-btn" style="background:#3498db;">Export CSV</a>
            <a href="/admin/reports" class="action-btn" style="background:#6c757d;">Back to Reports</a>
          </div>

          <div class="table-wrapper">
            <table class="user-table">
              <thead>
                <tr>${headerHtml}</tr>
              </thead>
              <tbody>
                ${rowHtml}
              </tbody>
            </table>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  if (reportId === 'users') {
    db.all('SELECT name, username, email, phone, role, is_active, created_at FROM users ORDER BY name', (err, users) => {
      if (err) users = [];
      const headers = ['Name', 'Username', 'Email', 'Phone', 'Role', 'Status', 'Created'];
      const rows = users.map(u => `
        <tr>
          <td>${u.name}</td>
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>${u.phone || '-'}</td>
          <td>${u.role}</td>
          <td><span class="status-badge ${u.is_active ? 'active' : 'inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>${u.created_at || '-'}</td>
        </tr>
      `);
      res.send(renderReport('Users & Contact Information', headers, rows, 7));
    });

  } else if (reportId === 'vehicles-winners') {
    db.all(`
      SELECT c.car_id, c.year, c.make, c.model, c.voter_id,
             v.vehicle_name, cl.class_name, u.name as owner_name,
             c.is_active
      FROM cars c
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      LEFT JOIN users u ON c.user_id = u.user_id
      ORDER BY u.name, c.make, c.model
    `, (err, cars) => {
      if (err) cars = [];

      // Get published results
      db.all(`
        SELECT pr.car_id, pr.result_type, pr.place, pr.total_score,
               cl.class_name, sv.vote_name
        FROM published_results pr
        LEFT JOIN classes cl ON pr.class_id = cl.class_id
        LEFT JOIN specialty_votes sv ON pr.specialty_vote_id = sv.specialty_vote_id
        ORDER BY pr.car_id, pr.result_type, pr.place
      `, (err, results) => {
        if (err) results = [];

        // Group results by car_id
        const resultsByCarId = {};
        results.forEach(r => {
          if (!resultsByCarId[r.car_id]) resultsByCarId[r.car_id] = [];
          const placeLabel = r.place === 1 ? '1st' : r.place === 2 ? '2nd' : '3rd';
          if (r.result_type === 'judge') {
            resultsByCarId[r.car_id].push(`${placeLabel} - ${r.class_name || 'N/A'} (Judge, ${r.total_score} pts)`);
          } else {
            resultsByCarId[r.car_id].push(`${placeLabel} - ${r.vote_name || 'N/A'} (Special Vote, ${r.total_score} votes)`);
          }
        });

        const headers = ['Voter ID', 'Year', 'Make', 'Model', 'Type', 'Class', 'Owner', 'Status', 'Awards'];
        const rows = cars.map(c => {
          const awards = resultsByCarId[c.car_id] ? resultsByCarId[c.car_id].join('; ') : '-';
          return `
            <tr>
              <td>${c.voter_id || '-'}</td>
              <td>${c.year || '-'}</td>
              <td>${c.make}</td>
              <td>${c.model}</td>
              <td>${c.vehicle_name || '-'}</td>
              <td>${c.class_name || '-'}</td>
              <td>${c.owner_name || '-'}</td>
              <td><span class="status-badge ${c.is_active ? 'active' : 'inactive'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
              <td style="white-space:normal;max-width:250px;">${awards}</td>
            </tr>
          `;
        });
        res.send(renderReport('Registered Vehicles with Winners', headers, rows, 9));
      });
    });

  } else if (reportId === 'vehicles-classes') {
    db.all(`
      SELECT c.voter_id, c.year, c.make, c.model,
             v.vehicle_name, cl.class_name
      FROM cars c
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      ORDER BY v.vehicle_name, cl.class_name, c.make, c.model
    `, (err, cars) => {
      if (err) cars = [];
      const headers = ['Voter ID', 'Year', 'Make', 'Model', 'Vehicle Type', 'Class'];
      const rows = cars.map(c => `
        <tr>
          <td>${c.voter_id || '-'}</td>
          <td>${c.year || '-'}</td>
          <td>${c.make}</td>
          <td>${c.model}</td>
          <td>${c.vehicle_name || '-'}</td>
          <td>${c.class_name || '-'}</td>
        </tr>
      `);
      res.send(renderReport('Vehicles by Class', headers, rows, 6));
    });

  } else if (reportId === 'specialty-votes') {
    db.all(`
      SELECT sv.*,
             (SELECT COUNT(*) FROM specialty_vote_voters WHERE specialty_vote_id = sv.specialty_vote_id) as voter_count,
             (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as vote_count
      FROM specialty_votes sv
      ORDER BY sv.vote_name
    `, (err, votes) => {
      if (err) votes = [];
      const headers = ['Name', 'Description', 'Who Can Vote', 'Assigned Voters', 'Votes Cast', 'Status'];
      const rows = votes.map(sv => `
        <tr>
          <td>${sv.vote_name}</td>
          <td>${sv.description || '-'}</td>
          <td>${sv.allow_all_users ? 'All Users' : 'Specific Users'}</td>
          <td>${sv.allow_all_users ? 'All' : sv.voter_count}</td>
          <td>${sv.vote_count}</td>
          <td><span class="status-badge ${sv.is_active ? 'active' : 'inactive'}">${sv.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
      `);
      res.send(renderReport('Specialty Votes', headers, rows, 6));
    });

  } else if (reportId === 'judging-config') {
    db.all(`
      SELECT jc.catagory_name, v.vehicle_name, jc.display_order as cat_order,
             jq.question, jq.min_score, jq.max_score, jq.display_order as q_order,
             jq.is_active as q_active, jc.is_active as cat_active
      FROM judge_catagories jc
      LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
      LEFT JOIN judge_questions jq ON jq.judge_catagory_id = jc.judge_catagory_id
      ORDER BY v.vehicle_name, jc.display_order, jc.catagory_name, jq.display_order
    `, (err, data) => {
      if (err) data = [];
      const headers = ['Vehicle Type', 'Category', 'Cat Order', 'Cat Status', 'Question', 'Min Score', 'Max Score', 'Q Order', 'Q Status'];
      const rows = data.map(d => `
        <tr>
          <td>${d.vehicle_name || '-'}</td>
          <td>${d.catagory_name}</td>
          <td>${d.cat_order}</td>
          <td><span class="status-badge ${d.cat_active ? 'active' : 'inactive'}">${d.cat_active ? 'Active' : 'Inactive'}</span></td>
          <td style="white-space:normal;">${d.question || '<em style="color:#999;">No questions</em>'}</td>
          <td>${d.min_score != null ? d.min_score : '-'}</td>
          <td>${d.max_score != null ? d.max_score : '-'}</td>
          <td>${d.q_order != null ? d.q_order : '-'}</td>
          <td>${d.q_active != null ? `<span class="status-badge ${d.q_active ? 'active' : 'inactive'}">${d.q_active ? 'Active' : 'Inactive'}</span>` : '-'}</td>
        </tr>
      `);
      res.send(renderReport('Judging Categories, Questions & Scoring', headers, rows, 9));
    });

  } else {
    res.redirect('/admin/reports');
  }
});

// Export report as CSV
app.get('/admin/reports/export/:reportId', requireAdmin, (req, res) => {
  const reportId = req.params.reportId;

  const sendCsv = (filename, headers, rows) => {
    const escapeCsv = (val) => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  };

  if (reportId === 'users') {
    db.all('SELECT name, username, email, phone, role, is_active, created_at FROM users ORDER BY name', (err, users) => {
      if (err) users = [];
      const headers = ['Name', 'Username', 'Email', 'Phone', 'Role', 'Status', 'Created'];
      const rows = users.map(u => [
        u.name, u.username, u.email, u.phone || '', u.role,
        u.is_active ? 'Active' : 'Inactive', u.created_at || ''
      ]);
      sendCsv('users_report.csv', headers, rows);
    });

  } else if (reportId === 'vehicles-winners') {
    db.all(`
      SELECT c.car_id, c.year, c.make, c.model, c.voter_id,
             v.vehicle_name, cl.class_name, u.name as owner_name,
             c.is_active
      FROM cars c
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      LEFT JOIN users u ON c.user_id = u.user_id
      ORDER BY u.name, c.make, c.model
    `, (err, cars) => {
      if (err) cars = [];

      db.all(`
        SELECT pr.car_id, pr.result_type, pr.place, pr.total_score,
               cl.class_name, sv.vote_name
        FROM published_results pr
        LEFT JOIN classes cl ON pr.class_id = cl.class_id
        LEFT JOIN specialty_votes sv ON pr.specialty_vote_id = sv.specialty_vote_id
        ORDER BY pr.car_id, pr.result_type, pr.place
      `, (err, results) => {
        if (err) results = [];

        const resultsByCarId = {};
        results.forEach(r => {
          if (!resultsByCarId[r.car_id]) resultsByCarId[r.car_id] = [];
          const placeLabel = r.place === 1 ? '1st' : r.place === 2 ? '2nd' : '3rd';
          if (r.result_type === 'judge') {
            resultsByCarId[r.car_id].push(`${placeLabel} - ${r.class_name || 'N/A'} (Judge, ${r.total_score} pts)`);
          } else {
            resultsByCarId[r.car_id].push(`${placeLabel} - ${r.vote_name || 'N/A'} (Special Vote, ${r.total_score} votes)`);
          }
        });

        const headers = ['Voter ID', 'Year', 'Make', 'Model', 'Type', 'Class', 'Owner', 'Status', 'Awards'];
        const rows = cars.map(c => [
          c.voter_id || '', c.year || '', c.make, c.model,
          c.vehicle_name || '', c.class_name || '', c.owner_name || '',
          c.is_active ? 'Active' : 'Inactive',
          resultsByCarId[c.car_id] ? resultsByCarId[c.car_id].join('; ') : ''
        ]);
        sendCsv('vehicles_winners_report.csv', headers, rows);
      });
    });

  } else if (reportId === 'vehicles-classes') {
    db.all(`
      SELECT c.voter_id, c.year, c.make, c.model,
             v.vehicle_name, cl.class_name
      FROM cars c
      LEFT JOIN vehicles v ON c.vehicle_id = v.vehicle_id
      LEFT JOIN classes cl ON c.class_id = cl.class_id
      ORDER BY v.vehicle_name, cl.class_name, c.make, c.model
    `, (err, cars) => {
      if (err) cars = [];
      const headers = ['Voter ID', 'Year', 'Make', 'Model', 'Vehicle Type', 'Class'];
      const rows = cars.map(c => [
        c.voter_id || '', c.year || '', c.make, c.model,
        c.vehicle_name || '', c.class_name || ''
      ]);
      sendCsv('vehicles_classes_report.csv', headers, rows);
    });

  } else if (reportId === 'specialty-votes') {
    db.all(`
      SELECT sv.*,
             (SELECT COUNT(*) FROM specialty_vote_voters WHERE specialty_vote_id = sv.specialty_vote_id) as voter_count,
             (SELECT COUNT(*) FROM specialty_vote_results WHERE specialty_vote_id = sv.specialty_vote_id) as vote_count
      FROM specialty_votes sv
      ORDER BY sv.vote_name
    `, (err, votes) => {
      if (err) votes = [];
      const headers = ['Name', 'Description', 'Who Can Vote', 'Assigned Voters', 'Votes Cast', 'Status'];
      const rows = votes.map(sv => [
        sv.vote_name, sv.description || '', sv.allow_all_users ? 'All Users' : 'Specific Users',
        sv.allow_all_users ? 'All' : String(sv.voter_count), String(sv.vote_count),
        sv.is_active ? 'Active' : 'Inactive'
      ]);
      sendCsv('specialty_votes_report.csv', headers, rows);
    });

  } else if (reportId === 'judging-config') {
    db.all(`
      SELECT jc.catagory_name, v.vehicle_name, jc.display_order as cat_order,
             jq.question, jq.min_score, jq.max_score, jq.display_order as q_order,
             jq.is_active as q_active, jc.is_active as cat_active
      FROM judge_catagories jc
      LEFT JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
      LEFT JOIN judge_questions jq ON jq.judge_catagory_id = jc.judge_catagory_id
      ORDER BY v.vehicle_name, jc.display_order, jc.catagory_name, jq.display_order
    `, (err, data) => {
      if (err) data = [];
      const headers = ['Vehicle Type', 'Category', 'Cat Order', 'Cat Status', 'Question', 'Min Score', 'Max Score', 'Q Order', 'Q Status'];
      const rows = data.map(d => [
        d.vehicle_name || '', d.catagory_name, String(d.cat_order),
        d.cat_active ? 'Active' : 'Inactive',
        d.question || '', d.min_score != null ? String(d.min_score) : '',
        d.max_score != null ? String(d.max_score) : '',
        d.q_order != null ? String(d.q_order) : '',
        d.q_active != null ? (d.q_active ? 'Active' : 'Inactive') : ''
      ]);
      sendCsv('judging_config_report.csv', headers, rows);
    });

  } else {
    res.redirect('/admin/reports');
  }
});

// Legacy dashboard redirect
app.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role === 'admin') {
    res.redirect('/admin');
  } else if (user.role === 'judge') {
    res.redirect('/judge');
  } else if (user.role === 'registrar') {
    res.redirect('/registrar');
  } else {
    res.redirect('/user');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

// HTTPS server with self-signed certificate
const options = {
  key: fs.readFileSync('/Users/matt/Desktop/My_Data/AI/Vibe_Coding/REPOS/key.pem'),
  cert:
fs.readFileSync('/Users/matt/Desktop/My_Data/AI/Vibe_Coding/REPOS/cert.pem')
};

https.createServer(options, app).listen(port, () => {
  console.log(`Car Show Voting App listening at https://localhost:${port}`);
  console.log('Note: You may see a security warning in your browser - this is expected for self-signed certificates');
});

console.log('To access the application:');
console.log('1. Open your browser and go to: https://localhost:3001');
console.log('2. You will see a security warning - accept it to continue');

